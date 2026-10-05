import crypto from 'node:crypto';

const MODES=new Set(['once','always','ask','never']);
const SCOPE_FIELDS=['capability','agent','sink','purpose','category','resource'];
const MAX_TEXT=240;

function text(value,fallback='*'){
  const out=String(value??fallback).trim();
  if(!out) return fallback;
  if(out.length>MAX_TEXT) throw new Error(`Consent scope values must be at most ${MAX_TEXT} characters`);
  return out;
}
function optionalTime(value){
  if(value==null) return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0) throw new Error('Consent expiry must be a positive timestamp');
  return n;
}
function clone(value){ return structuredClone(value); }
function scopeFrom(input={}){
  const scope={};
  for(const field of SCOPE_FIELDS) scope[field]=text(input[field],'*');
  if(scope.capability==='*') throw new Error('Consent capability must be explicit');
  return scope;
}
function matches(rule,request){
  return SCOPE_FIELDS.every(field=>rule.scope[field]==='*'||rule.scope[field]===request[field]);
}
function specificity(rule){ return SCOPE_FIELDS.reduce((n,field)=>n+(rule.scope[field]==='*'?0:1),0); }
function safeRule(rule){
  return {
    id:rule.id,
    mode:rule.mode,
    scope:clone(rule.scope),
    description:rule.description,
    source:'user',
    createdAt:rule.createdAt,
    expiresAt:rule.expiresAt,
    consumedAt:rule.consumedAt,
    active:!rule.revokedAt&&!rule.consumedAt,
    revokedAt:rule.revokedAt
  };
}

export function describeConsentRule({mode,scope}={}){
  const verb=({once:'Allow once',always:'Always allow',ask:'Always ask',never:'Never allow'})[mode]??String(mode);
  const pieces=[verb,scope?.agent&&scope.agent!=='*'?scope.agent:'any AI',`to ${scope?.capability??'perform this action'}`];
  if(scope?.category&&scope.category!=='*') pieces.push(`for ${scope.category}`);
  if(scope?.resource&&scope.resource!=='*') pieces.push(`on ${scope.resource}`);
  if(scope?.purpose&&scope.purpose!=='*') pieces.push(`for purpose “${scope.purpose}”`);
  if(scope?.sink&&scope.sink!=='*') pieces.push(`to ${scope.sink}`);
  return `${pieces.join(' ')}.`;
}

/**
 * User-owned consent registry for Hush capabilities. AI agents can be evaluated
 * against rules but this class intentionally exposes no MCP mutation surface.
 * `never` is conservative and wins over any overlapping allow rule. `once` is
 * consumed atomically when an authorization is actually granted.
 */
export class ConsentRegistry {
  constructor({now=()=>Date.now(),rules=[]}={}){
    this.now=now;
    this.rules=new Map();
    this.restore(rules);
  }

  restore(rules=[]){
    if(!Array.isArray(rules)) throw new Error('Consent rules must be an array');
    this.rules.clear();
    for(const raw of rules){
      if(!raw?.id||!MODES.has(raw.mode)||!raw.scope?.capability) continue;
      this.rules.set(String(raw.id),{
        id:String(raw.id),mode:String(raw.mode),scope:scopeFrom(raw.scope),description:text(raw.description,describeConsentRule(raw)),source:'user',
        createdAt:Number(raw.createdAt)||this.now(),expiresAt:optionalTime(raw.expiresAt),consumedAt:raw.consumedAt==null?null:Number(raw.consumedAt),revokedAt:raw.revokedAt==null?null:Number(raw.revokedAt)
      });
    }
    return this;
  }

  snapshot(){ return [...this.rules.values()].map(rule=>clone(rule)); }

  set({mode='ask',expiresAt=null,description=null,...scopeInput}={}){
    const normalizedMode=String(mode);
    if(!MODES.has(normalizedMode)) throw new Error('Consent mode must be once, always, ask, or never');
    const scope=scopeFrom(scopeInput);
    const rule={
      id:`consent_${crypto.randomBytes(18).toString('base64url')}`,
      mode:normalizedMode,
      scope,
      description:text(description,describeConsentRule({mode:normalizedMode,scope})),
      source:'user',createdAt:this.now(),expiresAt:optionalTime(expiresAt),consumedAt:null,revokedAt:null
    };
    this.rules.set(rule.id,rule);
    return safeRule(rule);
  }

  revoke(id){
    const rule=this.rules.get(String(id));
    if(!rule) return false;
    if(!rule.revokedAt) rule.revokedAt=this.now();
    return true;
  }

  list({includeInactive=true}={}){
    return [...this.rules.values()]
      .filter(rule=>includeInactive||this._active(rule))
      .map(safeRule)
      .sort((a,b)=>b.createdAt-a.createdAt||a.id.localeCompare(b.id));
  }

  _active(rule){
    if(rule.revokedAt||rule.consumedAt) return false;
    if(rule.expiresAt!=null&&this.now()>=rule.expiresAt) return false;
    return true;
  }

  evaluate(input={}, {consume=false}={}){
    const request={};
    for(const field of SCOPE_FIELDS) request[field]=text(input[field],field==='capability'?'':'*');
    if(!request.capability) throw new Error('Consent evaluation requires capability');

    const matched=[...this.rules.values()].filter(rule=>this._active(rule)&&matches(rule,request));
    const denied=matched.filter(rule=>rule.mode==='never').sort((a,b)=>specificity(b)-specificity(a)||b.createdAt-a.createdAt);
    if(denied.length){
      const rule=denied[0];
      return {decision:'deny',reason:'A user consent rule explicitly denies this request.',rule:safeRule(rule),request};
    }

    const candidates=matched.filter(rule=>rule.mode!=='never').sort((a,b)=>specificity(b)-specificity(a)||b.createdAt-a.createdAt);
    if(!candidates.length) return {decision:'ask',reason:'No user consent rule matched this request.',rule:null,request};

    const rule=candidates[0];
    if(rule.mode==='ask') return {decision:'ask',reason:'A user consent rule requires confirmation.',rule:safeRule(rule),request};
    if(rule.mode==='once'){
      if(consume) rule.consumedAt=this.now();
      return {decision:'allow',reason:'Allowed by one-time user consent.',rule:safeRule(rule),request,consumed:Boolean(consume)};
    }
    return {decision:'allow',reason:'Allowed by persistent user consent.',rule:safeRule(rule),request,consumed:false};
  }
}

export function consentModes(){ return [...MODES]; }
export function consentScopeFields(){ return [...SCOPE_FIELDS]; }
