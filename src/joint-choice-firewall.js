import {countChoicePosterior,SymbolicAnalysisLimitError} from './symbolic-choice-counter.js';

const DEFAULT_MAX_JOINT_STATES = 100_000;
const DEFAULT_MAX_OBSERVATIONS = 256;
const DEFAULT_MAX_SYMBOLIC_NODES = 100_000;

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
  const {_observation,_marginalKnowledgeBits,_totalKnowledgeBits,...safe}=assessment;
  return safe;
}

/**
 * Tracks realized leakage from protected choose programs.
 *
 * The preferred analysis is exact symbolic interval branch-and-bound: large private
 * regions are counted together when score/constraint bounds prove the winner cannot
 * change inside the region. Small or unsupported programs retain a bounded exact
 * enumeration fallback. If neither analysis fits its work budget, the result is
 * withheld rather than falling back to nominal output-cardinality accounting.
 */
export class JointChoiceReconstructionFirewall {
  constructor({maxKnowledgeBits=8,minRemaining=1,maxJointStates=DEFAULT_MAX_JOINT_STATES,maxObservations=DEFAULT_MAX_OBSERVATIONS,maxSymbolicNodes=DEFAULT_MAX_SYMBOLIC_NODES}={}){
    this.maxKnowledgeBits=finiteNonNegative(maxKnowledgeBits,8,'Joint knowledge budget');
    this.minRemaining=positiveSafeInteger(minRemaining,1,'minRemaining');
    this.maxJointStates=positiveSafeInteger(maxJointStates,DEFAULT_MAX_JOINT_STATES,'maxJointStates');
    this.maxObservations=positiveSafeInteger(maxObservations,DEFAULT_MAX_OBSERVATIONS,'maxObservations');
    this.maxSymbolicNodes=positiveSafeInteger(maxSymbolicNodes,DEFAULT_MAX_SYMBOLIC_NODES,'maxSymbolicNodes');
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
      if(!Number.isSafeInteger(currentProduct)){
        return {decision:'deny',reason:'Joint private-state space exceeds exact counting range; result withheld.',fields:component};
      }
      resolved[field]=state;
    }

    const relevant=this.observations.filter(observation=>observation.fields.every(field=>component.includes(field)));
    let before=0,after=0;
    let analysis={method:'enumeration',nodesVisited:null};
    let symbolicFailure=null;

    const symbolicReady=component.every(field=>Array.isArray(resolved[field].intervals)&&resolved[field].intervals.length>0);
    if(symbolicReady){
      try{
        const counted=countChoicePosterior({
          fields:component,
          fieldStates:resolved,
          observations:relevant,
          program,
          result,
          evaluateProgram,
          maxNodes:this.maxSymbolicNodes
        });
        before=counted.beforeCandidates;
        after=counted.afterCandidates;
        analysis={method:counted.method,nodesVisited:counted.nodesVisited,intervalBoxes:counted.intervalBoxes};
      }catch(error){
        symbolicFailure=error;
        if(!(error instanceof SymbolicAnalysisLimitError)){
          return {decision:'deny',reason:error?.message||'Symbolic joint-choice analysis failed; result withheld.',fields:component,analysis:{method:'symbolic-branch-and-bound',failed:true}};
        }
      }
    }

    if(!symbolicReady||symbolicFailure){
      if(currentProduct>this.maxJointStates){
        return {
          decision:'deny',
          reason:symbolicFailure?.message||'Joint private-state space exceeds analyzable limit; result withheld.',
          fields:component,
          currentCandidates:currentProduct,
          maxJointStates:this.maxJointStates,
          analysis:{method:symbolicReady?'symbolic-branch-and-bound':'enumeration',failed:Boolean(symbolicFailure)}
        };
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

      for(const observation of relevant){
        feasible=feasible.filter(assignment=>Object.is(evaluateProgram(observation.program,assignment),observation.result));
        if(!feasible.length) return {decision:'deny',reason:'Prior released choices are inconsistent with the current declared private state.',fields:component,beforeCandidates:0,afterCandidates:0};
      }
      before=feasible.length;
      after=feasible.filter(assignment=>Object.is(evaluateProgram(program,assignment),result)).length;
      analysis={method:'enumeration',nodesVisited:before};
    }

    if(before<1) return {decision:'deny',reason:'Prior released choices are inconsistent with the current declared private state.',fields:component,beforeCandidates:0,afterCandidates:0,analysis};
    if(after<1) return {decision:'deny',reason:'Observed choice is inconsistent with the declared joint private state.',fields:component,beforeCandidates:before,afterCandidates:0,analysis};

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
      analysis,
      _marginalKnowledgeBits:marginalKnowledgeBits,
      _totalKnowledgeBits:totalKnowledgeBits,
      _observation:{v:1,fields:requested,program:structuredClone(program),result:structuredClone(result)}
    };
  }

  commit(assessment){
    if(!assessment||assessment.decision!=='allow'||!assessment._observation) return false;
    const exactMarginal=assessment._marginalKnowledgeBits??assessment.marginalKnowledgeBits;
    if(exactMarginal<=1e-12) return true;
    if(this.observations.length>=this.maxObservations) throw new Error('Joint choice observation limit exceeded');
    this.observations.push(structuredClone(assessment._observation));
    return true;
  }

  footprint(){
    return this.observations.map((observation,index)=>({index,fields:[...observation.fields]}));
  }

  snapshot(){
    return {v:1,maxKnowledgeBits:this.maxKnowledgeBits,minRemaining:this.minRemaining,maxJointStates:this.maxJointStates,maxObservations:this.maxObservations,maxSymbolicNodes:this.maxSymbolicNodes,observations:structuredClone(this.observations)};
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
