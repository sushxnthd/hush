const PRIVACY_PREFERENCES=new Set(['strict','balanced','capability']);
const CONTEXT_MODES=new Set(['none','bounded','sanitized']);
const LOCALITIES=new Set(['local','remote']);
const TRUST_LEVELS=new Set(['limited','standard','trusted']);

function text(value,max=240){
  const out=String(value??'').trim();
  return out.length>max?out.slice(0,max):out;
}
function unique(values=[]){ return [...new Set((values??[]).map(value=>text(value,120)).filter(Boolean))].sort(); }
function finite(value,fallback=0){ const n=Number(value??fallback); if(!Number.isFinite(n)||n<0) throw new Error('Model router numeric fields must be finite and non-negative'); return n; }
function unit(value,fallback=0.5){ const n=Number(value??fallback); if(!Number.isFinite(n)||n<0||n>1) throw new Error('Model quality must be between 0 and 1'); return n; }
function trustRank(level){ return ({limited:0,standard:1,trusted:2})[level]??0; }

function normalizeModel(input={}){
  const id=text(input.id,160);
  if(!id) throw new Error('Model id is required');
  const provider=text(input.provider,160)||'unknown';
  const locality=String(input.locality??'remote');
  if(!LOCALITIES.has(locality)) throw new Error('Model locality must be local or remote');
  const trustLevel=String(input.trustLevel??(locality==='local'?'trusted':'limited'));
  if(!TRUST_LEVELS.has(trustLevel)) throw new Error('Unknown model trust level');
  return {
    id,provider,locality,trustLevel,
    capabilities:unique(input.capabilities),
    quality:unit(input.quality,0.5),
    inputCostPerMillion:finite(input.inputCostPerMillion,0),
    outputCostPerMillion:finite(input.outputCostPerMillion,0),
    latencyMs:finite(input.latencyMs,0),
    toolUse:Boolean(input.toolUse??true),
    enabled:input.enabled!==false,
    metadata:input.metadata&&typeof input.metadata==='object'&&!Array.isArray(input.metadata)?structuredClone(input.metadata):{}
  };
}

function normalizeRequest(input={}){
  const privateContext=String(input.privateContext??'none');
  if(privateContext==='raw') throw new Error('Hush router does not route tasks that require raw private context disclosure');
  if(!CONTEXT_MODES.has(privateContext)) throw new Error('privateContext must be none, bounded, or sanitized');
  const privacyPreference=String(input.privacyPreference??'balanced');
  if(!PRIVACY_PREFERENCES.has(privacyPreference)) throw new Error('privacyPreference must be strict, balanced, or capability');
  return {
    task:text(input.task,1000),
    requiredCapabilities:unique(input.requiredCapabilities),
    privateContext,
    privacyPreference,
    requiresTools:Boolean(input.requiresTools),
    maxInputCostPerMillion:input.maxInputCostPerMillion==null?Infinity:finite(input.maxInputCostPerMillion),
    maxOutputCostPerMillion:input.maxOutputCostPerMillion==null?Infinity:finite(input.maxOutputCostPerMillion),
    maxLatencyMs:input.maxLatencyMs==null?Infinity:finite(input.maxLatencyMs)
  };
}

function feasible(model,request){
  if(!model.enabled) return 'model-disabled';
  for(const capability of request.requiredCapabilities) if(!model.capabilities.includes(capability)) return `missing-capability:${capability}`;
  if(request.requiresTools&&!model.toolUse) return 'tool-use-required';
  if(model.inputCostPerMillion>request.maxInputCostPerMillion) return 'input-cost-limit';
  if(model.outputCostPerMillion>request.maxOutputCostPerMillion) return 'output-cost-limit';
  if(model.latencyMs>request.maxLatencyMs) return 'latency-limit';
  if(request.privateContext==='sanitized'&&request.privacyPreference==='strict'&&model.locality!=='local') return 'strict-sanitized-context-requires-local-model';
  if(request.privateContext==='sanitized'&&model.locality==='remote'&&model.trustLevel==='limited'&&request.privacyPreference!=='capability') return 'sanitized-context-requires-standard-or-trusted-remote-model';
  return null;
}

function score(model,request){
  let privacy=0;
  if(model.locality==='local') privacy+=request.privacyPreference==='strict'?30:request.privacyPreference==='balanced'?16:5;
  if(model.locality==='remote'&&request.privateContext==='bounded') privacy-=request.privacyPreference==='strict'?4:2;
  if(model.locality==='remote'&&request.privateContext==='sanitized') privacy-=request.privacyPreference==='capability'?8:22;
  privacy+=trustRank(model.trustLevel)*3;

  const quality=model.quality*100;
  const cost=(model.inputCostPerMillion+model.outputCostPerMillion)*0.5;
  const latency=Math.min(model.latencyMs/1000,20)*0.5;
  const total=quality+privacy-cost-latency;
  return {total,quality,privacy,costPenalty:cost,latencyPenalty:latency};
}

/**
 * Provider-neutral router. Model facts are user/config supplied; Hush does not
 * hard-code claims about provider privacy or model quality. Routing can therefore
 * consider capability, cost, latency, locality, declared trust, and the type of
 * private context a task actually requires.
 */
export class ModelRouter {
  constructor(){ this.models=new Map(); }

  register(model){
    const normalized=normalizeModel(model);
    this.models.set(normalized.id,normalized);
    return this.get(normalized.id);
  }

  remove(id){ return this.models.delete(String(id)); }
  get(id){ const model=this.models.get(String(id)); return model?structuredClone(model):null; }
  list(){ return [...this.models.values()].map(model=>structuredClone(model)).sort((a,b)=>a.id.localeCompare(b.id)); }

  route(input={}){
    const request=normalizeRequest(input);
    const rejected=[];
    const candidates=[];
    for(const model of this.models.values()){
      const reason=feasible(model,request);
      if(reason){ rejected.push({id:model.id,reason}); continue; }
      candidates.push({model,score:score(model,request)});
    }
    candidates.sort((a,b)=>b.score.total-a.score.total||b.model.quality-a.model.quality||a.model.id.localeCompare(b.model.id));
    if(!candidates.length){
      return {decision:'deny',reason:'No registered model satisfies the task, cost, latency, and privacy constraints.',request,rejected};
    }
    const winner=candidates[0];
    return {
      decision:'allow',
      model:{id:winner.model.id,provider:winner.model.provider,locality:winner.model.locality,trustLevel:winner.model.trustLevel},
      request,
      score:{
        total:Number(winner.score.total.toFixed(4)),
        quality:Number(winner.score.quality.toFixed(4)),
        privacy:Number(winner.score.privacy.toFixed(4)),
        costPenalty:Number(winner.score.costPenalty.toFixed(4)),
        latencyPenalty:Number(winner.score.latencyPenalty.toFixed(4))
      },
      alternatives:candidates.slice(1,5).map(candidate=>({id:candidate.model.id,provider:candidate.model.provider,total:Number(candidate.score.total.toFixed(4))})),
      rejected
    };
  }
}

export function modelRouterOptions(){
  return {privacyPreferences:[...PRIVACY_PREFERENCES],privateContextModes:[...CONTEXT_MODES],localities:[...LOCALITIES],trustLevels:[...TRUST_LEVELS]};
}
