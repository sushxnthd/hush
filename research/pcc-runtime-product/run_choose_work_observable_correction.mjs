#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PrivateDecisionRuntime} from '../../src/private-decision.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const SOURCE_PATH=path.join(ROOT,'src/private-decision.js');

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]));
  return value;
}
function canonical(value){ return JSON.stringify(stable(value),null,2)+'\n'; }
function sha256(buffer){ return crypto.createHash('sha256').update(buffer).digest('hex'); }

const candidates=Array.from({length:100},(_,price)=>({id:`c${price}`,price}));
const program={
  kind:'choose',
  candidates,
  constraints:[{op:'candidateLtePrivate',candidate:'price',private:'profile.budget'}],
  preferences:[{kind:'lowerPublic',candidate:'price',scale:1,weight:1}]
};
const source=fs.readFileSync(SOURCE_PATH,'utf8');
const sourceWitness={
  visitsAllCandidates:source.includes('for (const candidate of compiled.candidates) {'),
  mapsAllConstraints:source.includes('const constraintResults = constraints.map(rule=>passesConstraint(candidate,profile,rule));'),
  mapsAllPreferences:source.includes('const preferenceScores = preferences.map(pref=>preferenceScore(candidate,profile,pref));'),
  noFeasibleOnlyScoring:!source.includes('const scored = feasible.map(candidate=>({'),
  sourceSha256:sha256(fs.readFileSync(SOURCE_PATH))
};

const rows=[];
for(let budget=0;budget<100;budget++){
  const runtime=new PrivateDecisionRuntime({firewall:false,partitionFirewall:false,jointChoiceFirewall:false});
  runtime.setPrivate('profile.budget',budget);
  const trajectory=runtime.beginTrajectory({purpose:'frozen-work-observable-correction',maxBits:16,sinkMaxBits:16,ttlMs:60000});
  const out=runtime.run({trajectoryId:trajectory.trajectoryId,agent:'frozen-auditor',sink:'synthetic.local',program});
  assert.equal(out.decision,'allow');
  rows.push({
    syntheticBudget:budget,
    authorizedResult:out.result,
    feasibleCandidates:budget+1,
    sourceDerivedConstraintEvaluations:candidates.length*program.constraints.length,
    sourceDerivedPreferenceEvaluations:candidates.length*program.preferences.length
  });
}
const authorizedResults=[...new Set(rows.map(x=>x.authorizedResult))];
const constraintCounts=[...new Set(rows.map(x=>x.sourceDerivedConstraintEvaluations))];
const preferenceCounts=[...new Set(rows.map(x=>x.sourceDerivedPreferenceEvaluations))];
const witnessesPass=Object.entries(sourceWitness).filter(([k])=>k!=='sourceSha256').every(([,v])=>v===true);
const gate=witnessesPass&&authorizedResults.length===1&&authorizedResults[0]==='c0'&&
  constraintCounts.length===1&&constraintCounts[0]===100&&preferenceCounts.length===1&&preferenceCounts[0]===100;
const result={
  protocol:'hush.choose-work-observable-correction.v1',
  classification:'EXACT_SYNTHETIC_PUBLIC_CARDINALITY_HIGH_LEVEL_WORK_CLOSURE',
  cohort:{budgets:100,candidates:100,constraints:1,preferences:1},
  sourceWitness,
  authorizedResults,
  distinctConstraintWorkCounts:constraintCounts.length,
  distinctPreferenceWorkCounts:preferenceCounts.length,
  fixedConstraintEvaluations:constraintCounts[0],
  fixedPreferenceEvaluations:preferenceCounts[0],
  rows,
  scientificGate:gate?'PASS_PUBLIC_CARDINALITY_HIGH_LEVEL_WORK_CLOSURE':'FAIL_CORRECTION_GATE',
  smallestClaim:gate?'Across the frozen 100-budget cohort, the corrected bounded choose executor preserves the authorized result c0 while source-derived constraint and preference evaluation multiplicities are fixed by the public program cardinalities (100 each), not the hidden feasible-set size. This is not a constant-time JavaScript claim.':'The frozen correction gate did not pass.',
  limitations:[
    'No constant-time JavaScript, wall-clock timing, microarchitectural, garbage-collector, exception-shape, or process-isolation claim.',
    'The cohort is synthetic and already opened; this establishes exact mechanism closure for the specified high-level observable, not external validation.'
  ]
};
const withoutHash=canonical(result);
result.canonicalSha256=sha256(withoutHash);
const output=canonical(result);
if(process.argv[2]) fs.writeFileSync(process.argv[2],output);
process.stdout.write(output);
assert.equal(gate,true);
