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
  filtersBeforeScoring:source.includes('const feasible = compiled.candidates.filter(c => constraints.every(rule=>passesConstraint(c,profile,rule)));'),
  preferencesOnlyFeasible:source.includes('const scored = feasible.map(candidate=>({'),
  sourceSha256:sha256(fs.readFileSync(SOURCE_PATH))
};

const rows=[];
for(let budget=0;budget<100;budget++){
  const runtime=new PrivateDecisionRuntime({firewall:false,partitionFirewall:false,jointChoiceFirewall:false});
  runtime.setPrivate('profile.budget',budget);
  const trajectory=runtime.beginTrajectory({purpose:'frozen-work-observable',maxBits:16,sinkMaxBits:16,ttlMs:60000});
  const out=runtime.run({trajectoryId:trajectory.trajectoryId,agent:'frozen-auditor',sink:'synthetic.local',program});
  assert.equal(out.decision,'allow');
  rows.push({
    syntheticBudget:budget,
    authorizedResult:out.result,
    feasibleCandidates:budget+1,
    predictedConstraintEvaluations:100,
    predictedPreferenceEvaluations:budget+1
  });
}
const authorizedResults=[...new Set(rows.map(x=>x.authorizedResult))];
const workCounts=[...new Set(rows.map(x=>x.predictedPreferenceEvaluations))];
const gate=sourceWitness.filtersBeforeScoring&&sourceWitness.preferencesOnlyFeasible&&authorizedResults.length===1&&authorizedResults[0]==='c0'&&workCounts.length===100;
const result={
  protocol:'hush.choose-work-observable.v1',
  classification:'EXACT_SYNTHETIC_SAME_RELEASE_DIFFERENT_WORK_COUNTEREXAMPLE',
  cohort:{budgets:100,candidates:100,constraints:1,preferences:1},
  sourceWitness,
  authorizedResults,
  distinctPreferenceWorkCounts:workCounts.length,
  minimumPreferenceEvaluations:Math.min(...workCounts),
  maximumPreferenceEvaluations:Math.max(...workCounts),
  rows,
  scientificGate:gate?'PASS_SECRET_DEPENDENT_WORK_CHANNEL_CONFIRMED':'FAIL_COUNTEREXAMPLE_NOT_CONFIRMED',
  smallestClaim:gate?'For 100 synthetic hidden budgets with the same authorized winner c0, the current choose executor has 100 distinct source-derived preference-evaluation counts because it scores only the secret-dependent feasible set.':'The frozen same-release/different-work witness did not survive.'
};
const withoutHash=canonical(result);
result.canonicalSha256=sha256(withoutHash);
const output=canonical(result);
if(process.argv[2]) fs.writeFileSync(process.argv[2],output);
process.stdout.write(output);
assert.equal(gate,true);
