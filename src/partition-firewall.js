const DEFAULT_MAX_DOMAIN_SIZE = 10_000_000;
const DEFAULT_MAX_FRAGMENTS = 4096;

function finiteNonNegative(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n) || n < 0) throw new Error('Knowledge budget must be finite and non-negative');
  return n;
}

function normalizeIntegerDomain(domain, maxDomainSize = DEFAULT_MAX_DOMAIN_SIZE) {
  if (!domain || String(domain.type || '') !== 'integer') throw new Error('Partition firewall currently requires an integer domain');
  const min = Number(domain.min), max = Number(domain.max);
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) throw new Error('Integer domain requires safe integer min <= max');
  const size = max - min + 1;
  if (!Number.isSafeInteger(size) || size < 1 || size > maxDomainSize) throw new Error(`Integer domain must contain 1..${maxDomainSize} values`);
  return {type:'integer', min, max, size};
}

function countIntervals(intervals) {
  return intervals.reduce((sum, [lo, hi]) => sum + (hi - lo + 1), 0);
}

function intersectRange(intervals, lo, hi) {
  if (hi < lo) return [];
  const out = [];
  for (const [a,b] of intervals) {
    const x = Math.max(a,lo), y = Math.min(b,hi);
    if (x <= y) out.push([x,y]);
  }
  return out;
}

function retainPoints(intervals, values) {
  const points = [...new Set(values)].sort((a,b)=>a-b);
  const out=[];
  let i=0;
  for(const point of points){
    while(i<intervals.length && intervals[i][1] < point) i++;
    if(i<intervals.length && intervals[i][0] <= point && point <= intervals[i][1]) out.push([point,point]);
  }
  return out;
}

function removePoints(intervals, values, maxFragments) {
  const points = [...new Set(values)].sort((a,b)=>a-b);
  const out=[];
  let pi=0;
  for(const [lo,hi] of intervals){
    while(pi<points.length && points[pi] < lo) pi++;
    let cursor=lo;
    let j=pi;
    while(j<points.length && points[j] <= hi){
      const p=points[j];
      if(cursor <= p-1) out.push([cursor,p-1]);
      cursor=p+1;
      if(out.length > maxFragments) throw new Error('Partition refinement exceeds fragment limit');
      j++;
    }
    if(cursor <= hi) out.push([cursor,hi]);
    pi=j;
    if(out.length > maxFragments) throw new Error('Partition refinement exceeds fragment limit');
  }
  return out;
}

function numericThreshold(value) {
  const n=Number(value);
  if(!Number.isFinite(n)) throw new Error('Partition-aware numeric predicates require a finite public value');
  return n;
}

function integerPoints(value) {
  if(!Array.isArray(value)) throw new Error('Partition-aware in/notIn predicates require an array');
  const xs=value.map(Number);
  if(!xs.every(Number.isSafeInteger)) throw new Error('Partition-aware membership predicates require safe integer members');
  return xs;
}

function predicatePosterior(intervals, program, result, maxFragments) {
  const op=String(program?.op||'');
  const truth=Boolean(result);
  if(op==='eq'||op==='neq'){
    const v=numericThreshold(program.value);
    if(!Number.isSafeInteger(v)) {
      const condition = op==='neq';
      return truth===condition ? intervals.map(x=>[...x]) : [];
    }
    const wantEqual = op==='eq' ? truth : !truth;
    return wantEqual ? retainPoints(intervals,[v]) : removePoints(intervals,[v],maxFragments);
  }
  if(op==='in'||op==='notIn'){
    const points=integerPoints(program.value);
    const wantIn = op==='in' ? truth : !truth;
    return wantIn ? retainPoints(intervals,points) : removePoints(intervals,points,maxFragments);
  }
  const x=numericThreshold(program.value);
  let lo=-Infinity,hi=Infinity;
  if(op==='lt') { if(truth) hi=Math.ceil(x)-1; else lo=Math.ceil(x); }
  else if(op==='lte') { if(truth) hi=Math.floor(x); else lo=Math.floor(x)+1; }
  else if(op==='gt') { if(truth) lo=Math.floor(x)+1; else hi=Math.floor(x); }
  else if(op==='gte') { if(truth) lo=Math.ceil(x); else hi=Math.ceil(x)-1; }
  else throw new Error(`Unsupported partition-aware predicate: ${op}`);
  return intersectRange(intervals,lo,hi);
}

function bucketPosterior(intervals, program, result) {
  const thresholds=program?.thresholds;
  if(!Array.isArray(thresholds)||thresholds.length<1) throw new Error('Partition-aware bucket requires thresholds');
  const xs=thresholds.map(Number);
  if(!xs.every(Number.isFinite)) throw new Error('Partition-aware bucket thresholds must be finite');
  for(let i=1;i<xs.length;i++) if(xs[i] <= xs[i-1]) throw new Error('Partition-aware bucket thresholds must be strictly increasing');
  const bucket=Number(result);
  if(!Number.isInteger(bucket)||bucket<0||bucket>xs.length) throw new Error('Partition-aware bucket result is invalid');
  const lo=bucket===0?-Infinity:Math.floor(xs[bucket-1])+1;
  const hi=bucket===xs.length?Infinity:Math.floor(xs[bucket]);
  return intersectRange(intervals,lo,hi);
}

function publicAssessment(x) {
  const {_posterior,...safe}=x;
  return safe;
}

export class PartitionAwareReconstructionFirewall {
  constructor({maxKnowledgeBits=8,minRemaining=1,maxDomainSize=DEFAULT_MAX_DOMAIN_SIZE,maxFragments=DEFAULT_MAX_FRAGMENTS}={}){
    this.maxKnowledgeBits=finiteNonNegative(maxKnowledgeBits,8);
    this.minRemaining=Math.max(1,Number(minRemaining||1));
    if(!Number.isSafeInteger(this.minRemaining)) throw new Error('minRemaining must be a positive safe integer');
    this.maxDomainSize=Math.max(1,Number(maxDomainSize||DEFAULT_MAX_DOMAIN_SIZE));
    this.maxFragments=Math.max(1,Number(maxFragments||DEFAULT_MAX_FRAGMENTS));
    if(!Number.isSafeInteger(this.maxDomainSize)||!Number.isSafeInteger(this.maxFragments)) throw new Error('Partition firewall limits must be safe integers');
    this.fields=new Map();
  }

  registerField(field,domain){
    const key=String(field||'');
    if(!key) throw new Error('Partition field is required');
    const d=normalizeIntegerDomain(domain,this.maxDomainSize);
    this.fields.set(key,{field:key,domain:d,initialCount:d.size,intervals:[[d.min,d.max]]});
    return this.status(key);
  }

  hasField(field){ return this.fields.has(String(field)); }

  resetField(field){
    const state=this.fields.get(String(field));
    if(!state) return false;
    state.intervals=[[state.domain.min,state.domain.max]];
    return true;
  }

  evaluate({field,program,result}={}){
    const key=String(field||'');
    const state=this.fields.get(key);
    if(!state) return {decision:'skip',reason:'No declared finite domain for this private field.'};
    if(String(program?.private||'')!==key) return {decision:'deny',reason:'Partition-aware program field mismatch.',field:key};

    let posterior;
    try{
      const kind=String(program?.kind||'');
      if(kind==='predicate') posterior=predicatePosterior(state.intervals,program,result,this.maxFragments);
      else if(kind==='bucket') posterior=bucketPosterior(state.intervals,program,result);
      else return {decision:'deny',reason:'Registered finite-domain fields require analyzable predicate or bucket semantics.',field:key};
    }catch(error){
      return {decision:'deny',reason:error?.message||'Partition refinement failed.',field:key};
    }

    if(posterior.length>this.maxFragments) return {decision:'deny',reason:'Partition refinement exceeds fragment limit.',field:key};
    const before=countIntervals(state.intervals), after=countIntervals(posterior);
    if(after<1) return {decision:'deny',reason:'Observed result is inconsistent with the declared private domain.',field:key,beforeCandidates:before,afterCandidates:0};
    const marginalBits=Math.log2(before/after);
    const totalKnowledgeBits=Math.log2(state.initialCount/after);
    const blocked = totalKnowledgeBits > this.maxKnowledgeBits + 1e-12 || after < this.minRemaining;
    return {
      decision:blocked?'deny':'allow',
      reason:blocked?'Realized posterior knowledge exceeds the partition privacy limit.':'Realized posterior knowledge is within the partition privacy limit.',
      field:key,
      beforeCandidates:before,
      afterCandidates:after,
      marginalKnowledgeBits:Number(marginalBits.toFixed(9)),
      totalKnowledgeBits:Number(totalKnowledgeBits.toFixed(9)),
      maxKnowledgeBits:this.maxKnowledgeBits,
      minRemaining:this.minRemaining,
      _posterior:posterior
    };
  }

  commit(assessment){
    if(!assessment||assessment.decision!=='allow'||!assessment._posterior) return false;
    const state=this.fields.get(String(assessment.field));
    if(!state) return false;
    state.intervals=assessment._posterior.map(([lo,hi])=>[lo,hi]);
    return true;
  }

  assessAndCommit(input){
    const assessment=this.evaluate(input);
    if(assessment.decision==='allow') this.commit(assessment);
    return publicAssessment(assessment);
  }

  candidateValues(field,{limit=this.maxDomainSize}={}){
    const state=this.fields.get(String(field));
    if(!state) return null;
    const remaining=countIntervals(state.intervals);
    const bounded=Number(limit);
    if(!Number.isSafeInteger(bounded)||bounded<1) throw new Error('Candidate value limit must be a positive safe integer');
    if(remaining>bounded) throw new Error('Finite posterior exceeds candidate enumeration limit');
    const values=[];
    for(const [lo,hi] of state.intervals){
      for(let value=lo;value<=hi;value++) values.push(value);
    }
    return values;
  }

  status(field){
    const state=this.fields.get(String(field));
    if(!state) return null;
    const remaining=countIntervals(state.intervals);
    return {field:state.field,domain:{...state.domain},initialCandidates:state.initialCount,remainingCandidates:remaining,totalKnowledgeBits:Number(Math.log2(state.initialCount/remaining).toFixed(9)),maxKnowledgeBits:this.maxKnowledgeBits,minRemaining:this.minRemaining,fragments:state.intervals.length};
  }

  footprint(){ return [...this.fields.keys()].sort().map(field=>this.status(field)); }

  snapshot(){
    return {v:1,maxKnowledgeBits:this.maxKnowledgeBits,minRemaining:this.minRemaining,maxDomainSize:this.maxDomainSize,maxFragments:this.maxFragments,fields:[...this.fields.values()].map(state=>({field:state.field,domain:{...state.domain},initialCount:state.initialCount,intervals:state.intervals.map(x=>[...x])}))};
  }

  restore(snapshot={}){
    if(snapshot?.v!==1) return this;
    this.fields.clear();
    for(const item of Array.isArray(snapshot.fields)?snapshot.fields:[]){
      const d=normalizeIntegerDomain(item.domain,this.maxDomainSize);
      const intervals=Array.isArray(item.intervals)?item.intervals.map(x=>[Number(x[0]),Number(x[1])]):[];
      if(!intervals.length||intervals.some(([lo,hi])=>!Number.isSafeInteger(lo)||!Number.isSafeInteger(hi)||lo<d.min||hi>d.max||lo>hi)) throw new Error('Invalid partition firewall snapshot');
      if(intervals.length>this.maxFragments) throw new Error('Partition firewall snapshot exceeds fragment limit');
      this.fields.set(String(item.field),{field:String(item.field),domain:d,initialCount:d.size,intervals});
    }
    return this;
  }
}

export const stripPartitionInternals=publicAssessment;
