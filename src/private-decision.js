import crypto from 'node:crypto';
import {canonicalize, sha256} from './core.js';
import {PersistentReconstructionFirewall} from './reconstruction-firewall.js';
import {PartitionAwareReconstructionFirewall, stripPartitionInternals} from './partition-firewall.js';
import {JointChoiceReconstructionFirewall, stripJointChoiceInternals} from './joint-choice-firewall.js';

const OPS = new Set(['eq','neq','lt','lte','gt','gte','in','notIn']);
const MAX_CANDIDATES = 100;
const FORBIDDEN_PATH_PARTS = new Set(['__proto__','prototype','constructor']);

function pathParts(path) {
  const parts=String(path).split('.').filter(Boolean);
  if(!parts.length) throw new Error('Private path required');
  if(parts.some(part=>FORBIDDEN_PATH_PARTS.has(part))) throw new Error('Unsafe private path');
  return parts;
}

function setPath(root,path,value){
  const parts=pathParts(path);
  let node=root;
  for(let i=0;i<parts.length-1;i++){
    const part=parts[i];
    if(!Object.hasOwn(node,part)) node[part]=Object.create(null);
    else if(!node[part]||typeof node[part]!=='object'||Array.isArray(node[part])) throw new Error('Private path collision');
    node=node[part];
  }
  node[parts.at(-1)]=value;
}

function profileFromAssignment(assignment){
  const profile=Object.create(null);
  for(const [field,value] of Object.entries(assignment??{})) setPath(profile,field,value);
  return profile;
}

export function capacityBits(cardinality) {
  const n = Number(cardinality);
  if (!Number.isInteger(n) || n < 1) throw new Error('Output cardinality must be a positive integer');
  return Math.log2(n);
}

export function privatePathsForProgram(program) {
  const kind=String(program?.kind||'');
  if(kind==='predicate'||kind==='bucket') return program?.private?[String(program.private)]:[];
  if(kind==='choose') {
    const paths=[];
    for(const rule of Array.isArray(program?.constraints)?program.constraints:[]) if(rule?.private) paths.push(String(rule.private));
    for(const pref of Array.isArray(program?.preferences)?program.preferences:[]) if(pref?.private) paths.push(String(pref.private));
    return [...new Set(paths)].sort();
  }
  return [];
}

function getPath(root, path) {
  const parts = pathParts(path);
  let value = root;
  for (const part of parts) {
    if (value == null || typeof value !== 'object' || !Object.hasOwn(value,part)) throw new Error(`Private field not found: ${path}`);
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
  if (!Object.hasOwn(candidate,String(field))) throw new Error(`Candidate field not found: ${field}`);
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
 * Four accounting layers can apply:
 * - short-lived task/sink budgets;
 * - persistent cross-task reconstruction accounting;
 * - single-field realized partition accounting;
 * - joint-choice realized accounting for analyzable multi-field choose programs.
 *
 * These are explicit-channel defenses only. Timing, crashes, external side effects,
 * covert channels and data released outside this runtime are not covered.
 */
export class PrivateDecisionRuntime {
  constructor({now=()=>Date.now(),firewall=undefined,partitionFirewall=undefined,jointChoiceFirewall=undefined}={}) {
    this.now=now;
    this.profile=Object.create(null);
    this.profileRevision=0;
    this.trajectories=new Map();
    this.firewall=firewall===false||firewall===null?null:(firewall??new PersistentReconstructionFirewall({now}));
    this.partitionFirewall=partitionFirewall===false||partitionFirewall===null?null:(partitionFirewall??new PartitionAwareReconstructionFirewall());
    this.jointChoiceFirewall=jointChoiceFirewall===false||jointChoiceFirewall===null?null:(jointChoiceFirewall??new JointChoiceReconstructionFirewall());
  }

  setPrivate(path,value,{domain=undefined}={}) {
    const parts=pathParts(path);
    let node=this.profile;
    for (let i=0;i<parts.length-1;i++) {
      const part=parts[i];
      if (!Object.hasOwn(node,part) || !node[part] || typeof node[part] !== 'object' || Array.isArray(node[part])) node[part]=Object.create(null);
      node=node[part];
    }
    node[parts.at(-1)]=structuredClone(value);
    this.profileRevision++;
    this.jointChoiceFirewall?.resetField(path);
    if(domain!==undefined) this.registerPrivateDomain(path,domain);
    else if(this.partitionFirewall?.hasField(path)) this.partitionFirewall.resetField(path);
    return {path:String(path),revision:this.profileRevision,partitionProtected:Boolean(this.partitionFirewall?.hasField(path))};
  }

  registerPrivateDomain(path,domain) {
    const key=String(path);
    const value=getPath(this.profile,key);
    if(!Number.isSafeInteger(value)) throw new Error('Declared integer privacy domains require a safe-integer private value');
    const status=this.partitionFirewall?.registerField(key,domain);
    if(status && (value<status.domain.min || value>status.domain.max)) {
      this.partitionFirewall.fields.delete(key);
      throw new Error('Private value is outside its declared privacy domain');
    }
    return status;
  }

  partitionFootprint(){ return this.partitionFirewall?.footprint()??[]; }
  jointChoiceFootprint(){ return this.jointChoiceFirewall?.footprint()??[]; }

  beginTrajectory({purpose='unspecified',maxBits=8,sinkMaxBits=maxBits,ttlMs=30*60*1000}={}) {
    const global=Number(maxBits),sink=Number(sinkMaxBits),ttl=Number(ttlMs);
    if (![global,sink].every(x=>Number.isFinite(x)&&x>=0)) throw new Error('Bit budgets must be finite and non-negative');
    if(!Number.isFinite(ttl)||ttl<1000) throw new Error('Trajectory TTL must be finite and at least 1000 ms');
    const id=`pdp_${crypto.randomBytes(24).toString('base64url')}`;
    const boundedTtl=Math.min(ttl,24*60*60*1000);
    const issuedAt=this.now();
    const t={id,purpose:String(purpose),maxBits:global,sinkMaxBits:sink,spentBits:0,sinkSpent:new Map(),seen:new Set(),issuedAt,expiresAt:issuedAt+boundedTtl,revokedAt:null};
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
    const privatePaths=privatePathsForProgram(normalizedProgram);
    privatePaths.forEach(path=>pathParts(path));
    const sinkKey=String(sink);
    const queryHash=sha256(canonicalize({programHash,profileRevision:this.profileRevision,sink:sinkKey}));
    const repeat=t.seen.has(queryHash);
    const nominalBits=repeat?0:capacityBits(compiled.cardinality);

    const result=executeProgram(normalizedProgram,compiled,this.profile);
    let partitionAssessment=null;
    let jointAssessment=null;

    if(compiled.kind!=='choose' && privatePaths.length===1 && this.partitionFirewall?.hasField(privatePaths[0])) {
      partitionAssessment=this.partitionFirewall.evaluate({field:privatePaths[0],program:normalizedProgram,result});
      if(partitionAssessment.decision==='deny') {
        const partition=stripPartitionInternals(partitionAssessment);
        return {decision:'deny',reason:partition.reason,capacity:{marginalBits:0,nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(t.spentBits.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number((t.sinkSpent.get(sinkKey)??0).toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting:'realized-partition'},partition};
      }
    }

    if(compiled.kind==='choose' && privatePaths.length>=1 && this.jointChoiceFirewall) {
      const protectedCount=privatePaths.filter(path=>this.partitionFirewall?.hasField(path)).length;
      const allProtected=protectedCount===privatePaths.length;
      if(protectedCount>0 && !allProtected){
        return {decision:'deny',reason:'Protected private fields cannot be mixed with undeclared fields in an analyzable choice.',capacity:{marginalBits:0,nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(t.spentBits.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number((t.sinkSpent.get(sinkKey)??0).toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting:'fail-closed-mixed-domain'}};
      }
      if(allProtected){
        const compiledCache=new Map();
        const evaluateProgram=(probe,assignment)=>{
          const key=sha256(canonicalize(probe));
          let cached=compiledCache.get(key);
          if(!cached){
            const probeCompiled=compileProgram(probe);
            cached={compiled:probeCompiled,program:probeCompiled.kind==='choose'?{...probe,candidates:probeCompiled.candidates}:probe};
            compiledCache.set(key,cached);
          }
          return executeProgram(cached.program,cached.compiled,profileFromAssignment(assignment));
        };
        jointAssessment=this.jointChoiceFirewall.evaluate({
          fields:privatePaths,
          program:normalizedProgram,
          result,
          evaluateProgram,
          getFieldState:(field)=>{
            const status=this.partitionFirewall.status(field);
            if(!status) return null;
            return {
              initialCandidates:status.initialCandidates,
              remainingCandidates:status.remainingCandidates,
              intervals:this.partitionFirewall.candidateIntervals(field),
              values:()=>this.partitionFirewall.candidateValues(field,{limit:this.jointChoiceFirewall.maxJointStates})
            };
          }
        });
        if(jointAssessment.decision==='deny'){
          const joint=stripJointChoiceInternals(jointAssessment);
          return {decision:'deny',reason:joint.reason,capacity:{marginalBits:0,nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(t.spentBits.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number((t.sinkSpent.get(sinkKey)??0).toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting:'realized-joint-choice'},joint};
        }
      }
    }

    const realizedAssessment=jointAssessment?.decision==='allow'?jointAssessment:partitionAssessment?.decision==='allow'?partitionAssessment:null;
    const bits=repeat?0:(realizedAssessment?realizedAssessment.marginalKnowledgeBits:nominalBits);
    const accounting=jointAssessment?.decision==='allow'?'realized-joint-choice':partitionAssessment?.decision==='allow'?'realized-partition':'output-cardinality';
    const sinkBefore=t.sinkSpent.get(sinkKey)??0;
    const globalAfter=t.spentBits+bits;
    const sinkAfter=sinkBefore+bits;
    const capacity={marginalBits:Number(bits.toFixed(6)),nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(t.spentBits.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number(sinkBefore.toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting};

    if(globalAfter>t.maxBits+1e-12 || sinkAfter>t.sinkMaxBits+1e-12) {
      return {decision:'deny',reason:'Explicit information-capacity budget exceeded.',capacity,...(partitionAssessment?{partition:stripPartitionInternals(partitionAssessment)}:{}),...(jointAssessment?{joint:stripJointChoiceInternals(jointAssessment)}:{})};
    }

    const reconstruction=this.firewall?.evaluate({
      privatePaths,
      audience:sinkKey,
      programHash,
      profileRevision:this.profileRevision,
      bits
    })??null;
    if(reconstruction?.decision==='deny') {
      return {decision:'deny',reason:reconstruction.reason,capacity,reconstruction,...(partitionAssessment?{partition:stripPartitionInternals(partitionAssessment)}:{}),...(jointAssessment?{joint:stripJointChoiceInternals(jointAssessment)}:{})};
    }

    t.seen.add(queryHash);
    t.spentBits=globalAfter;
    t.sinkSpent.set(sinkKey,sinkAfter);
    const resultHash=sha256(canonicalize(result));
    const recorded=this.firewall?.record({
      privatePaths,
      audience:sinkKey,
      programHash,
      profileRevision:this.profileRevision,
      bits,
      trajectoryId:t.id,
      resultHash
    })??null;
    if(partitionAssessment?.decision==='allow') this.partitionFirewall.commit(partitionAssessment);
    if(jointAssessment?.decision==='allow') this.jointChoiceFirewall.commit(jointAssessment);

    return {
      decision:'allow',
      result,
      capacity:{marginalBits:Number(bits.toFixed(6)),nominalBits:Number(nominalBits.toFixed(6)),spentBits:Number(globalAfter.toFixed(6)),maxBits:t.maxBits,sinkSpentBits:Number(sinkAfter.toFixed(6)),sinkMaxBits:t.sinkMaxBits,cardinality:compiled.cardinality,repeat,accounting},
      reconstruction:recorded,
      ...(partitionAssessment?{partition:stripPartitionInternals(partitionAssessment)}:{}),
      ...(jointAssessment?{joint:stripJointChoiceInternals(jointAssessment)}:{}),
      receipt:{v:1,at:this.now(),trajectoryId:t.id,purpose:t.purpose,agent:String(agent),sink:sinkKey,programHash,privatePathsHash:sha256(canonicalize(privatePaths)),profileRevision:this.profileRevision,resultHash,privateValuesIncluded:false}
    };
  }
}
