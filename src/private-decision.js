import crypto from 'node:crypto';
import {canonicalize, sha256} from './core.js';

const OPS = new Set(['eq','neq','lt','lte','gt','gte','in','notIn']);
const MAX_CANDIDATES = 100;

export function capacityBits(cardinality) {
  const n = Number(cardinality);
  if (!Number.isInteger(n) || n < 1) throw new Error('Output cardinality must be a positive integer');
  return Math.log2(n);
}

function getPath(root, path) {
  const parts = String(path).split('.').filter(Boolean);
  let value = root;
  for (const part of parts) {
    if (value == null || typeof value !== 'object' || !(part in value)) throw new Error(`Private field not found: ${path}`);
    value = value[part];
  }
  return value;
}

function cmp(left, op, right) {
  if (!OPS.has(op)) throw new Error(`Unsupported comparison: ${op}`);
  if (op === 'eq') return left === right;
  if (op === 'neq') return left !== right;
  if (op === 'lt') return left < right;
  if (op === 'lte') return left <= right;
  if (op === 'gt') return left > right;
  if (op === 'gte') return left >= right;
  if (op === 'in') return Array.isArray(right) && right.includes(left);
  if (op === 'notIn') return Array.isArray(right) && !right.includes(left);
  return false;
}

function normalizeCandidates(candidates) {
  if (!Array.isArray(candidates) || candidates.length < 1) throw new Error('choose requires at least one candidate');
  if (candidates.length > MAX_CANDIDATES) throw new Error(`choose supports at most ${MAX_CANDIDATES} candidates`);
  const ids = new Set();
  return candidates.map(candidate => {
    if (!candidate || typeof candidate !== 'object') throw new Error('Candidate must be an object');
    const id = String(candidate.id ?? '');
    if (!id) throw new Error('Candidate id is required');
    if (ids.has(id)) throw new Error(`Duplicate candidate id: ${id}`);
    ids.add(id);
    return structuredClone(candidate);
  }).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
}

function candidateValue(candidate, field) {
  if (!(String(field) in candidate)) throw new Error(`Candidate field not found: ${field}`);
  return candidate[String(field)];
}

function passesConstraint(candidate, profile, rule) {
  const op = String(rule?.op || '');
  const c = candidateValue(candidate, rule?.candidate);
  const p = getPath(profile, rule?.private);
  if (op === 'candidateLtePrivate') return cmp(c,'lte',p);
  if (op === 'candidateGtePrivate') return cmp(c,'gte',p);
  if (op === 'candidateEqPrivate') return cmp(c,'eq',p);
  if (op === 'candidateInPrivate') return cmp(c,'in',p);
  if (op === 'candidateNotInPrivate') return cmp(c,'notIn',p);
  if (op === 'privateLteCandidate') return cmp(p,'lte',c);
  if (op === 'privateGteCandidate') return cmp(p,'gte',c);
  throw new Error(`Unsupported choose constraint: ${op}`);
}

function preferenceScore(candidate, profile, pref) {
  const kind = String(pref?.kind || '');
  const weight = Number(pref?.weight ?? 1);
  if (!Number.isFinite(weight)) throw new Error('Preference weight must be finite');
  const c = candidateValue(candidate, pref?.candidate);
  if (kind === 'matchPrivate') {
    const p = getPath(profile, pref?.private);
    return c === p ? weight : 0;
  }
  if (kind === 'nearPrivate') {
    const p = Number(getPath(profile, pref?.private));
    const x = Number(c);
    const scale = Number(pref?.scale ?? 1);
    if (![p,x,scale].every(Number.isFinite) || scale <= 0) throw new Error('nearPrivate expects finite numeric values and positive scale');
    return -Math.abs(x-p)/scale*weight;
  }
  if (kind === 'lowerPublic') {
    const x = Number(c);
    const scale = Number(pref?.scale ?? 1);
    if (![x,scale].every(Number.isFinite) || scale <= 0) throw new Error('lowerPublic expects finite numeric value and positive scale');
    return -x/scale*weight;
  }
  if (kind === 'higherPublic') {
    const x = Number(c);
    const scale = Number(pref?.scale ?? 1);
    if (![x,scale].every(Number.isFinite) || scale <= 0) throw new Error('higherPublic expects finite numeric value and positive scale');
    return x/scale*weight;
  }
  throw new Error(`Unsupported choose preference: ${kind}`);
}

function compileProgram(program) {
  const kind = String(program?.kind || '');
  if (kind === 'predicate') return {kind,cardinality:2};
  if (kind === 'bucket') {
    const thresholds = program?.thresholds;
    if (!Array.isArray(thresholds) || thresholds.length < 1 || thresholds.length > 63) throw new Error('bucket expects 1..63 thresholds');
    const xs = thresholds.map(Number);
    if (!xs.every(Number.isFinite)) throw new Error('bucket thresholds must be finite');
    for (let i=1;i<xs.length;i++) if (xs[i] <= xs[i-1]) throw new Error('bucket thresholds must be strictly increasing');
    return {kind,cardinality:xs.length+1};
  }
  if (kind === 'choose') {
    const candidates = normalizeCandidates(program?.candidates);
    // Returning one candidate id or null has N+1 possible explicit outputs.
    return {kind,cardinality:candidates.length+1,candidates};
  }
  throw new Error(`Unsupported private decision program: ${kind}`);
}

function executeProgram(program, compiled, profile) {
  if (compiled.kind === 'predicate') {
    const left = getPath(profile, program.private);
    return cmp(left,String(program.op),program.value);
  }
  if (compiled.kind === 'bucket') {
    const value = Number(getPath(profile, program.private));
    if (!Number.isFinite(value)) throw new Error('bucket private value must be numeric');
    const thresholds = program.thresholds.map(Number);
    let bucket = 0;
    while (bucket < thresholds.length && value > thresholds[bucket]) bucket++;
    return bucket;
  }
  if (compiled.kind === 'choose') {
    const constraints = Array.isArray(program.constraints) ? program.constraints : [];
    const preferences = Array.isArray(program.preferences) ? program.preferences : [];
    const feasible = compiled.candidates.filter(c => constraints.every(rule=>passesConstraint(c,profile,rule)));
    if (!feasible.length) return null;
    const scored = feasible.map(candidate=>({
      id:String(candidate.id),
      score:preferences.reduce((s,p)=>s+preferenceScore(candidate,profile,p),0)
    }));
    scored.sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
    return scored[0].id;
  }
  throw new Error('Program was not compiled');
}

/**
 * Private Decision Programs turn personal context into a bounded output channel.
 *
 * If a program's result is restricted to a finite output set Ω, then for any secret
 * S and any adaptive caller, I(S;Y) <= H(Y) <= log2(|Ω|) for that explicit result.
 * Across a transcript, the chain rule gives the conservative bound
 * I(S;Y_1..Y_n) <= Σ log2(|Ω_i|). This runtime enforces that sum per trajectory.
 *
 * This is an explicit-channel bound only. Timing, crashes, external side effects,
 * covert channels and data released outside this runtime are not covered.
 */
export class PrivateDecisionRuntime {
  constructor({now=()=>Date.now()}={}) {
    this.now=now;
    this.profile={};
    this.profileRevision=0;
    this.trajectories=new Map();
  }

  setPrivate(path,value) {
    const parts=String(path).split('.').filter(Boolean);
    if (!parts.length) throw new Error('Private path required');
    let node=this.profile;
    for (let i=0;i<parts.length-1;i++) {
      const part=parts[i];
      if (!node[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part]={};
      node=node[part];
    }
    node[parts.at(-1)]=structuredClone(value);
    this.profileRevision++;
    return {path:String(path),revision:this.profileRevision};
  }

  beginTrajectory({purpose='unspecified',maxBits=8,sinkMaxBits=maxBits,ttlMs=30*60*1000}={}) {
    const global=Number(maxBits),sink=Number(sinkMaxBits);
    if (![global,sink].every(x=>Number.isFinite(x)&&x>=0)) throw new Error('Bit budgets must be finite and non-negative');
    const id=`pdp_${crypto.randomBytes(24).toString('base64url')}`;
    const t={id,purpose:String(purpose),maxBits:global,sinkMaxBits:sink,spentBits:0,sinkSpent:new Map(),seen:new Set(),issuedAt:this.now(),expiresAt:this.now()+Math.max(1000,Math.min(Number(ttlMs),24*60*60*1000)),revokedAt:null};
    this.trajectories.set(id,t);
    return {trajectoryId:id,purpose:t.purpose,maxBits:t.maxBits,sinkMaxBits:t.sinkMaxBits,expiresAt:t.expiresAt};
  }

  revokeTrajectory(id) {
    const t=this.trajectories.get(String(id));
    if(!t) return false;
    t.revokedAt=this.now();
    return true;
  }

  _trajectory(id) {
    const t=this.trajectories.get(String(id));
    if(!t) throw new Error('Private decision trajectory not found');
    if(t.revokedAt) throw new Error('Private decision trajectory revoked');
    if(this.now()>=t.expiresAt) throw new Error('Private decision trajectory expired');
    return t;
  }

  run({trajectoryId,agent='unknown-agent',sink='unknown-sink',program}) {
    const t=this._trajectory(trajectoryId);
    const compiled=compileProgram(program);
    const normalizedProgram=compiled.kind==='choose'?{...program,candidates:compiled.candidates}:program;
    const programHash=sha256(canonicalize(normalizedProgram));
    const queryHash=sha256(canonicalize({programHash,profileRevision:this.profileRevision,sink:String(sink)}));
    const repeat=t.seen.has(queryHash);
    const bits=repeat?0:capacityBits(compiled.cardinality);
    const sinkKey=String(sink);
    const sinkBefore=t.sinkSpent.get(sinkKey)??0;
    const globalAfter=t.spentBits+bits;
    const sinkAfter=sinkBefore+bits;
    if(globalAfter>t.maxBits+1e-12 || sinkAfter>t.sinkMaxBits+1e-12) {
      return {decision:'deny',reason:'Explicit information-capacity budget exceeded.',capacity:{marginalBits:bits,spentBits:t.spentBits,maxBits:t.maxBits,sinkSpentBits:sinkBefore,sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality}};
    }
    const result=executeProgram(normalizedProgram,compiled,this.profile);
    t.seen.add(queryHash);
    t.spentBits=globalAfter;
    t.sinkSpent.set(sinkKey,sinkAfter);
    return {
      decision:'allow',
      result,
      capacity:{marginalBits:Number(bits.toFixed(6)),spentBits:Number(globalAfter.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number(sinkAfter.toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat},
      receipt:{v:1,at:this.now(),trajectoryId:t.id,purpose:t.purpose,agent:String(agent),sink:sinkKey,programHash,profileRevision:this.profileRevision,resultHash:sha256(canonicalize(result)),privateValuesIncluded:false}
    };
  }
}
