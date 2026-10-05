const DEFAULT_MAX_NODES = 100_000;
const DEFAULT_MAX_INTERVAL_BOXES = 4096;

function positiveSafeInteger(value,fallback,label){
  const n=Number(value??fallback);
  if(!Number.isSafeInteger(n)||n<1) throw new Error(`${label} must be a positive safe integer`);
  return n;
}

function uniqueFields(fields=[]){
  return [...new Set(fields.map(String).filter(Boolean))].sort();
}

function safeProduct(values,label){
  let product=1;
  for(const value of values){
    product*=value;
    if(!Number.isSafeInteger(product)) throw new Error(`${label} exceeds exact integer counting range`);
  }
  return product;
}

function boxCount(box,fields){
  return safeProduct(fields.map(field=>box[field][1]-box[field][0]+1),'Symbolic private-state count');
}

function isSingleton(box,fields){
  return fields.every(field=>box[field][0]===box[field][1]);
}

function exactAssignment(box,fields){
  const out=Object.create(null);
  for(const field of fields) out[field]=box[field][0];
  return out;
}

function publicNumber(value){
  return typeof value==='number'&&Number.isFinite(value)?value:null;
}

function constraintStatus(candidate,rule,box){
  const field=String(rule?.private||'');
  const range=box[field];
  if(!range) return 0;
  const [lo,hi]=range;
  const op=String(rule?.op||'');
  const raw=candidate?.[String(rule?.candidate)];

  if(op==='candidateEqPrivate'){
    if(typeof raw!=='number'||!Number.isSafeInteger(raw)) return -1;
    if(raw<lo||raw>hi) return -1;
    return lo===hi&&lo===raw?1:0;
  }
  if(op==='candidateInPrivate'||op==='candidateNotInPrivate'){
    // Declared finite integer private fields are scalar numbers. The runtime's
    // in/notIn forms require the private side to be an array, so both are false.
    return -1;
  }

  const c=publicNumber(raw);
  if(c===null) return 0;
  if(op==='candidateLtePrivate'){
    if(c<=lo) return 1;
    if(c>hi) return -1;
    return 0;
  }
  if(op==='candidateGtePrivate'){
    if(c>=hi) return 1;
    if(c<lo) return -1;
    return 0;
  }
  if(op==='privateLteCandidate'){
    if(hi<=c) return 1;
    if(lo>c) return -1;
    return 0;
  }
  if(op==='privateGteCandidate'){
    if(lo>=c) return 1;
    if(hi<c) return -1;
    return 0;
  }
  return 0;
}

function preferenceBounds(candidate,pref,box){
  const kind=String(pref?.kind||'');
  const weight=Number(pref?.weight??1);
  if(!Number.isFinite(weight)) return null;
  const raw=candidate?.[String(pref?.candidate)];

  if(kind==='lowerPublic'||kind==='higherPublic'){
    const x=Number(raw),scale=Number(pref?.scale??1);
    if(!Number.isFinite(x)||!Number.isFinite(scale)||scale<=0) return null;
    const score=(kind==='lowerPublic'?-x:x)/scale*weight;
    return [score,score];
  }

  const field=String(pref?.private||'');
  const range=box[field];
  if(!range) return null;
  const [lo,hi]=range;

  if(kind==='matchPrivate'){
    if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<lo||raw>hi) return [0,0];
    if(lo===hi&&lo===raw) return [weight,weight];
    return weight>=0?[0,weight]:[weight,0];
  }

  if(kind==='nearPrivate'){
    const x=Number(raw),scale=Number(pref?.scale??1);
    if(!Number.isFinite(x)||!Number.isFinite(scale)||scale<=0) return null;
    const minDistance=x<lo?lo-x:x>hi?x-hi:0;
    const maxDistance=Math.max(Math.abs(x-lo),Math.abs(x-hi));
    const a=-minDistance/scale*weight;
    const b=-maxDistance/scale*weight;
    return [Math.min(a,b),Math.max(a,b)];
  }

  return null;
}

function candidateBounds(candidate,program,box){
  let feasibility=1;
  for(const rule of Array.isArray(program?.constraints)?program.constraints:[]){
    const status=constraintStatus(candidate,rule,box);
    if(status<0) return {feasibility:-1,minScore:-Infinity,maxScore:-Infinity};
    if(status===0) feasibility=0;
  }

  let minScore=0,maxScore=0;
  for(const pref of Array.isArray(program?.preferences)?program.preferences:[]){
    const bounds=preferenceBounds(candidate,pref,box);
    if(!bounds) return {feasibility,unknownScore:true,minScore:-Infinity,maxScore:Infinity};
    minScore+=bounds[0];
    maxScore+=bounds[1];
  }
  return {feasibility,minScore,maxScore,unknownScore:false};
}

function dominates(left,right){
  if(left.minScore>right.maxScore) return true;
  if(left.minScore===right.maxScore && String(left.id).localeCompare(String(right.id))<0) return true;
  return false;
}

function classifyChoice(program,box,fields,evaluateProgram){
  if(String(program?.kind||'')!=='choose') return {known:false};
  if(isSingleton(box,fields)){
    return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  }

  const candidates=Array.isArray(program?.candidates)?program.candidates:[];
  if(!candidates.length) return {known:false};
  const bounds=candidates.map(candidate=>({id:String(candidate?.id??''),...candidateBounds(candidate,program,box)}));
  if(bounds.some(row=>row.unknownScore)) return {known:false};
  const possible=bounds.filter(row=>row.feasibility>=0);
  if(!possible.length) return {known:true,result:null};

  for(const candidate of possible){
    if(candidate.feasibility!==1) continue;
    let guaranteed=true;
    for(const other of possible){
      if(other===candidate) continue;
      if(!dominates(candidate,other)){ guaranteed=false; break; }
    }
    if(guaranteed) return {known:true,result:candidate.id};
  }
  return {known:false};
}


function classifyPredicate(program,box,fields,evaluateProgram){
  const field=String(program?.private||'');
  const range=box[field];
  if(!range) return {known:false};
  if(range[0]===range[1]) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  const [lo,hi]=range;
  const op=String(program?.op||'');
  const raw=program?.value;

  if(op==='eq'||op==='neq'){
    const v=Number(raw);
    const equalPossible=Number.isSafeInteger(v)&&v>=lo&&v<=hi;
    const equalCertain=lo===hi&&lo===v;
    if(!equalPossible) return {known:true,result:op==='neq'};
    if(equalCertain) return {known:true,result:op==='eq'};
    return {known:false};
  }

  if(op==='in'||op==='notIn'){
    if(!Array.isArray(raw)) return {known:false};
    const values=[...new Set(raw.map(Number).filter(value=>Number.isSafeInteger(value)&&value>=lo&&value<=hi))];
    const covered=values.length;
    const width=hi-lo+1;
    if(covered===0) return {known:true,result:op==='notIn'};
    if(covered===width) return {known:true,result:op==='in'};
    return {known:false};
  }

  const x=Number(raw);
  if(!Number.isFinite(x)) return {known:false};
  if(op==='lt'){
    if(hi<x) return {known:true,result:true};
    if(lo>=x) return {known:true,result:false};
  }else if(op==='lte'){
    if(hi<=x) return {known:true,result:true};
    if(lo>x) return {known:true,result:false};
  }else if(op==='gt'){
    if(lo>x) return {known:true,result:true};
    if(hi<=x) return {known:true,result:false};
  }else if(op==='gte'){
    if(lo>=x) return {known:true,result:true};
    if(hi<x) return {known:true,result:false};
  }
  return {known:false};
}

function classifyBucket(program,box,fields,evaluateProgram){
  const field=String(program?.private||'');
  const range=box[field];
  if(!range) return {known:false};
  if(range[0]===range[1]) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  const thresholds=Array.isArray(program?.thresholds)?program.thresholds.map(Number):[];
  if(!thresholds.length||!thresholds.every(Number.isFinite)) return {known:false};
  const bucketAt=value=>{
    let bucket=0;
    while(bucket<thresholds.length&&value>thresholds[bucket]) bucket++;
    return bucket;
  };
  const a=bucketAt(range[0]),b=bucketAt(range[1]);
  return a===b?{known:true,result:a}:{known:false};
}

function classifyProgram(program,box,fields,evaluateProgram){
  const kind=String(program?.kind||'');
  if(kind==='choose') return classifyChoice(program,box,fields,evaluateProgram);
  if(kind==='predicate') return classifyPredicate(program,box,fields,evaluateProgram);
  if(kind==='bucket') return classifyBucket(program,box,fields,evaluateProgram);
  if(isSingleton(box,fields)) return {known:true,result:evaluateProgram(program,exactAssignment(box,fields))};
  return {known:false};
}

function splitBox(box,fields){
  let splitField=null,maxWidth=0;
  for(const field of fields){
    const [lo,hi]=box[field];
    const width=hi-lo;
    if(width>maxWidth){ maxWidth=width; splitField=field; }
  }
  if(!splitField) return null;
  const [lo,hi]=box[splitField];
  const mid=Math.floor((lo+hi)/2);
  return [
    {...box,[splitField]:[lo,mid]},
    {...box,[splitField]:[mid+1,hi]}
  ];
}

function intervalBoxes(fields,fieldStates,maxIntervalBoxes){
  let combinations=1;
  for(const field of fields){
    const intervals=fieldStates[field]?.intervals;
    if(!Array.isArray(intervals)||!intervals.length) throw new Error('Symbolic choice accounting requires finite-domain intervals');
    combinations*=intervals.length;
    if(!Number.isSafeInteger(combinations)||combinations>maxIntervalBoxes) throw new Error('Posterior interval fragmentation exceeds symbolic analysis limit');
  }
  const boxes=[];
  const walk=(index,box)=>{
    if(index===fields.length){ boxes.push(box); return; }
    const field=fields[index];
    for(const pair of fieldStates[field].intervals){
      if(!Array.isArray(pair)||pair.length!==2) throw new Error('Invalid finite-domain interval');
      const lo=Number(pair[0]),hi=Number(pair[1]);
      if(!Number.isSafeInteger(lo)||!Number.isSafeInteger(hi)||lo>hi) throw new Error('Invalid finite-domain interval');
      walk(index+1,{...box,[field]:[lo,hi]});
    }
  };
  walk(0,Object.create(null));
  return boxes;
}

export class SymbolicAnalysisLimitError extends Error {
  constructor(message){ super(message); this.name='SymbolicAnalysisLimitError'; }
}

/**
 * Exactly counts the before/after support of a realized choose result using
 * interval branch-and-bound. Whole private-state boxes are counted at once when
 * score/constraint bounds prove the winner is invariant. Ambiguous boxes split
 * until they can be certified or the analysis work budget is exhausted.
 */
export function countChoicePosterior({fields,fieldStates,observations=[],program,result,evaluateProgram,maxNodes=DEFAULT_MAX_NODES,maxIntervalBoxes=DEFAULT_MAX_INTERVAL_BOXES}={}){
  const ordered=uniqueFields(fields);
  if(!ordered.length) throw new Error('Symbolic choice accounting requires private fields');
  if(typeof evaluateProgram!=='function') throw new Error('Symbolic choice accounting requires an exact evaluator');
  const nodeLimit=positiveSafeInteger(maxNodes,DEFAULT_MAX_NODES,'maxNodes');
  const boxLimit=positiveSafeInteger(maxIntervalBoxes,DEFAULT_MAX_INTERVAL_BOXES,'maxIntervalBoxes');
  const boxes=intervalBoxes(ordered,fieldStates,boxLimit);
  const prior=Array.isArray(observations)?observations:[];

  let beforeCandidates=0,afterCandidates=0,nodesVisited=0;
  const visit=()=>{
    nodesVisited++;
    if(nodesVisited>nodeLimit) throw new SymbolicAnalysisLimitError('Symbolic joint-choice analysis exceeded its work budget; result withheld.');
  };
  const add=(name,count)=>{
    const next=(name==='before'?beforeCandidates:afterCandidates)+count;
    if(!Number.isSafeInteger(next)) throw new SymbolicAnalysisLimitError('Symbolic joint-choice count exceeds exact integer range; result withheld.');
    if(name==='before') beforeCandidates=next; else afterCandidates=next;
  };

  const walkAfter=(box)=>{
    visit();
    const classification=classifyProgram(program,box,ordered,evaluateProgram);
    if(classification.known){
      if(Object.is(classification.result,result)) add('after',boxCount(box,ordered));
      return;
    }
    const children=splitBox(box,ordered);
    if(!children){
      const exact=evaluateProgram(program,exactAssignment(box,ordered));
      if(Object.is(exact,result)) add('after',boxCount(box,ordered));
      return;
    }
    children.forEach(walkAfter);
  };

  const walkBefore=(box)=>{
    visit();
    for(const observation of prior){
      const classification=classifyProgram(observation.program,box,ordered,evaluateProgram);
      if(classification.known && !Object.is(classification.result,observation.result)) return;
      if(!classification.known){
        const children=splitBox(box,ordered);
        if(!children){
          const assignment=exactAssignment(box,ordered);
          if(!Object.is(evaluateProgram(observation.program,assignment),observation.result)) return;
          continue;
        }
        children.forEach(walkBefore);
        return;
      }
    }
    const count=boxCount(box,ordered);
    add('before',count);
    walkAfter(box);
  };

  boxes.forEach(walkBefore);
  return {beforeCandidates,afterCandidates,nodesVisited,intervalBoxes:boxes.length,method:'symbolic-branch-and-bound'};
}
