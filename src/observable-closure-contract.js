import {canonicalize,sha256} from './core.js';
import {certifyLifecycleTraceAuthorization} from './lifecycle-trace-contract.js';

const MODES=new Set(['broker-owned','suppressed','independently-verified']);
const clone=value=>structuredClone(value);
const unique=values=>[...new Set((values??[]).map(String).filter(Boolean))];

function constantTrace(worlds,traces){
  if(traces==null) return true;
  let first;
  for(const world of worlds){
    if(!Object.prototype.hasOwnProperty.call(traces,world)) throw new Error(`Observable trace is missing world ${world}`);
    const value=canonicalize(traces[world]);
    if(first===undefined) first=value;
    else if(value!==first) return false;
  }
  return true;
}

/**
 * Certify a finite external-observability boundary.
 *
 * The boundary is configured by the broker/deployer, never by adapter registration.
 * Every external channel must be broker-owned, suppressed, or independently verified.
 * Closed channel traces must refine the global authorization.
 */
export function certifyObservableClosure({worlds,globalAuthorization,externalChannels,closure}={}){
  if(!Array.isArray(worlds)||!worlds.length) throw new Error('Observable closure requires non-empty worlds');
  const channels=unique(externalChannels).sort();
  if(!channels.length) throw new Error('Observable closure requires at least one external channel');
  if(!closure||typeof closure!=='object'||Array.isArray(closure)){
    return {safe:false,reason:'OBSERVABLE_CLOSURE_INCOMPLETE',missing:channels};
  }
  const normalized={};
  for(const channel of channels){
    const entry=closure[channel];
    if(!entry||!MODES.has(entry.mode)){
      return {safe:false,reason:'OBSERVABLE_CLOSURE_INCOMPLETE',missing:[channel]};
    }
    const mode=entry.mode;
    const traces=entry.traces==null?null:clone(entry.traces);
    if(mode==='suppressed'){
      if(!constantTrace(worlds,traces)){
        return {safe:false,reason:'SUPPRESSED_CHANNEL_NOT_CONSTANT',channel};
      }
    }else{
      if(!traces) return {safe:false,reason:'OBSERVABLE_TRACE_MISSING',channel};
      const certificate=certifyLifecycleTraceAuthorization({worlds,globalAuthorization,traces});
      if(!certificate.safe){
        return {safe:false,reason:'OBSERVABLE_TRACE_REFINEMENT',channel,witness:certificate.witness};
      }
    }
    normalized[channel]={mode,traces};
  }
  const extras=Object.keys(closure).filter(channel=>!channels.includes(channel)).sort();
  const commitment=sha256(canonicalize({v:1,worlds,globalAuthorization,externalChannels:channels,closure:normalized}));
  return {safe:true,reason:'CERTIFIED',channels,extras,commitment,closure:normalized};
}
