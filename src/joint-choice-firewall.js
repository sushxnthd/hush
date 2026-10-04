const DEFAULT_MAX_JOINT_STATES = 100_000;
const DEFAULT_MAX_OBSERVATIONS = 256;

function positiveSafeInteger(value, fallback, label) {
  const n=Number(value??fallback);
  if(!Number.isSafeInteger(n)||n<1) throw new Error(`${label} must be a positive safe integer`);
  return n;
}

function finiteNonNegative(value, fallback, label) {
  const n=Number(value??fallback);
  if(!Number.isFinite(n)||n<0) throw new Error(`${label} must be finite and non-negative`);
  return n;
}

function uniqueFields(fields=[]) {
  return [...new Set(fields.map(String).filter(Boolean))].sort();
}

function intersects(a,b) {
  const set=new Set(a);
  return b.some(x=>set.has(x));
}

function componentFor(fields, observations) {
  const component=new Set(uniqueFields(fields));
  let changed=true;
  while(changed){
    changed=false;
    for(const observation of observations){
      if(!intersects([...component],observation.fields)) continue;
      for(const field of observation.fields){
        if(!component.has(field)){ component.add(field); changed=true; }
      }
    }
  }
  return [...component].sort();
}

function cartesian(assignments, fields, valueLists, index, maxStates) {
  if(index===fields.length) return [assignments];
  const field=fields[index];
  const values=valueLists[field];
  if(!Array.isArray(values)||!values.length) return [];
  const out=[];
  for(const value of values){
    const next={...assignments,[field]:value};
    const suffix=cartesian(next,fields,valueLists,index+1,maxStates);
    out.push(...suffix);
    if(out.length>maxStates) throw new Error('Joint private-state space exceeds analyzable limit');
  }
  return out;
}

function publicAssessment(assessment) {
  const {_observation,...safe}=assessment;
  return safe;
}

export class JointChoiceReconstructionFirewall {
  constructor({maxKnowledgeBits=8,minRemaining=1,maxJointStates=DEFAULT_MAX_JOINT_STATES,maxObservations=DEFAULT_MAX_OBSERVATIONS}={}){
    this.maxKnowledgeBits=finiteNonNegative(maxKnowledgeBits,8,'Joint knowledge budget');
    this.minRemaining=positiveSafeInteger(minRemaining,1,'minRemaining');
    this.maxJointStates=positiveSafeInteger(maxJointStates,DEFAULT_MAX_JOINT_STATES,'maxJointStates');
    this.maxObservations=positiveSafeInteger(maxObservations,DEFAULT_MAX_OBSERVATIONS,'maxObservations');
    this.observations=[];
  }

  resetField(field){
    const key=String(field||'');
    const before=this.observations.length;
    this.observations=this.observations.filter(observation=>!observation.fields.includes(key));
    return before!==this.observations.length;
  }

  evaluate({fields,getFieldState,program,result,evaluateProgram}={}){
    const requested=uniqueFields(fields);
    if(requested.length<1) return {decision:'skip',reason:'Choice accounting requires at least one private field.'};
    if(typeof evaluateProgram!=='function') throw new Error('Joint choice accounting requires an evaluator');
    if(typeof getFieldState!=='function') throw new Error('Joint choice accounting requires finite-domain field state');

    const component=componentFor(requested,this.observations);
    let initialKnowledgeBits=0;
    let currentProduct=1;
    const resolved=Object.create(null);

    for(const field of component){
      let state;
      try{ state=getFieldState(field); }
      catch(error){ return {decision:'deny',reason:error?.message||'Unable to read finite-domain state.',fields:component}; }
      if(!state||!Number.isSafeInteger(state.initialCandidates)||state.initialCandidates<1||!Number.isSafeInteger(state.remainingCandidates)||state.remainingCandidates<1){
        return {decision:'deny',reason:'Joint choice accounting requires declared finite domains for every connected private field.',fields:component};
      }
      initialKnowledgeBits+=Math.log2(state.initialCandidates);
      currentProduct*=state.remainingCandidates;
      if(!Number.isSafeInteger(currentProduct)||currentProduct>this.maxJointStates){
        return {decision:'deny',reason:'Joint private-state space exceeds analyzable limit; result withheld.',fields:component,currentCandidates:currentProduct,maxJointStates:this.maxJointStates};
      }
      resolved[field]=state;
    }

    const valueLists=Object.create(null);
    for(const field of component){
      try{
        const values=typeof resolved[field].values==='function'?resolved[field].values():resolved[field].values;
        if(!Array.isArray(values)||values.length!==resolved[field].remainingCandidates) throw new Error('Finite-domain candidate enumeration mismatch');
        valueLists[field]=values;
      }catch(error){
        return {decision:'deny',reason:error?.message||'Unable to enumerate finite-domain values.',fields:component};
      }
    }

    let feasible;
    try{
      feasible=cartesian({},component,valueLists,0,this.maxJointStates);
    }catch(error){
      return {decision:'deny',reason:error?.message||'Unable to enumerate joint private state.',fields:component,maxJointStates:this.maxJointStates};
    }

    const relevant=this.observations.filter(observation=>observation.fields.every(field=>component.includes(field)));
    for(const observation of relevant){
      feasible=feasible.filter(assignment=>Object.is(evaluateProgram(observation.program,assignment),observation.result));
      if(!feasible.length) return {decision:'deny',reason:'Prior released choices are inconsistent with the current declared private state.',fields:component,beforeCandidates:0,afterCandidates:0};
    }

    const before=feasible.length;
    const posterior=feasible.filter(assignment=>Object.is(evaluateProgram(program,assignment),result));
    const after=posterior.length;
    if(after<1) return {decision:'deny',reason:'Observed choice is inconsistent with the declared joint private state.',fields:component,beforeCandidates:before,afterCandidates:0};

    const marginalKnowledgeBits=Math.log2(before/after);
    const totalKnowledgeBits=initialKnowledgeBits-Math.log2(after);
    const blocked=totalKnowledgeBits>this.maxKnowledgeBits+1e-12||after<this.minRemaining;
    return {
      decision:blocked?'deny':'allow',
      reason:blocked?'Realized joint-choice knowledge exceeds the privacy limit.':'Realized joint-choice knowledge is within the privacy limit.',
      fields:component,
      beforeCandidates:before,
      afterCandidates:after,
      marginalKnowledgeBits:Number(marginalKnowledgeBits.toFixed(9)),
      totalKnowledgeBits:Number(totalKnowledgeBits.toFixed(9)),
      maxKnowledgeBits:this.maxKnowledgeBits,
      minRemaining:this.minRemaining,
      observationsComposed:relevant.length,
      _observation:{v:1,fields:requested,program:structuredClone(program),result:structuredClone(result)}
    };
  }

  commit(assessment){
    if(!assessment||assessment.decision!=='allow'||!assessment._observation) return false;
    if(assessment.marginalKnowledgeBits<=1e-12) return true;
    if(this.observations.length>=this.maxObservations) throw new Error('Joint choice observation limit exceeded');
    this.observations.push(structuredClone(assessment._observation));
    return true;
  }

  footprint(){
    return this.observations.map((observation,index)=>({index,fields:[...observation.fields]}));
  }

  snapshot(){
    return {v:1,maxKnowledgeBits:this.maxKnowledgeBits,minRemaining:this.minRemaining,maxJointStates:this.maxJointStates,maxObservations:this.maxObservations,observations:structuredClone(this.observations)};
  }

  restore(snapshot={}){
    if(snapshot?.v!==1) return this;
    const observations=Array.isArray(snapshot.observations)?snapshot.observations:[];
    if(observations.length>this.maxObservations) throw new Error('Joint choice snapshot exceeds observation limit');
    this.observations=observations.map(observation=>({
      v:1,
      fields:uniqueFields(observation.fields),
      program:structuredClone(observation.program),
      result:structuredClone(observation.result)
    })).filter(observation=>observation.fields.length>=1);
    return this;
  }
}

export const stripJointChoiceInternals=publicAssessment;
