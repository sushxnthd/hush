import {canonicalize,sha256} from './core.js';

function clone(value){ return structuredClone(value); }

function validate({worlds,globalAuthorization,traces}){
  if(!Array.isArray(worlds)||worlds.length<2||new Set(worlds).size!==worlds.length) throw new Error('worlds must contain at least two unique ids');
  for(const [label,map] of [['globalAuthorization',globalAuthorization],['traces',traces]]){
    if(!map||typeof map!=='object'||Array.isArray(map)) throw new Error(`${label} must be a map`);
    for(const world of worlds) if(!(world in map)) throw new Error(`${label} missing world ${world}`);
  }
}

function equal(left,right){ return canonicalize(left)===canonicalize(right); }

/**
 * Exact finite-world certificate for every externally visible discrete lifecycle
 * observation. Absence is data: an empty/missing phase must be represented in
 * the declared canonical trace rather than omitted from the security model.
 */
export function certifyLifecycleTraceAuthorization({worlds,globalAuthorization,traces}){
  validate({worlds,globalAuthorization,traces});
  const canonicalTraces={};
  for(const world of worlds){
    const trace=traces[world];
    if(!Array.isArray(trace)) throw new Error(`traces.${world} must be an array`);
    canonicalTraces[world]=clone(trace);
  }
  for(let i=0;i<worlds.length;i+=1){
    for(let j=i+1;j<worlds.length;j+=1){
      const left=worlds[i],right=worlds[j];
      if(equal(globalAuthorization[left],globalAuthorization[right])&&!equal(canonicalTraces[left],canonicalTraces[right])){
        return {safe:false,reason:'LIFECYCLE_TRACE_REFINEMENT',witness:{left,right,leftTrace:canonicalTraces[left],rightTrace:canonicalTraces[right]}};
      }
    }
  }
  return {safe:true,reason:'CERTIFIED',witness:null,commitment:sha256(canonicalize({v:1,worlds,globalAuthorization,traces:canonicalTraces}))};
}

/** Payload-only control: deliberately ignores the observable distinction between
 * event absence and presence. Used only to reproduce the falsified baseline. */
export function payloadOnlyLifecycleSafe({worlds,globalAuthorization,traces}){
  validate({worlds,globalAuthorization,traces});
  for(let i=0;i<worlds.length;i+=1){
    for(let j=i+1;j<worlds.length;j+=1){
      const left=worlds[i],right=worlds[j];
      if(!equal(globalAuthorization[left],globalAuthorization[right])) continue;
      const a=traces[left],b=traces[right];
      if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length) throw new Error('payload-only traces must use fixed slots');
      for(let phase=0;phase<a.length;phase+=1){
        if(a[phase]!==null&&b[phase]!==null&&!equal(a[phase],b[phase])) return false;
      }
    }
  }
  return true;
}
