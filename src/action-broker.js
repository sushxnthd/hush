import crypto from 'node:crypto';
import {canonicalize,detectSensitive,sha256} from './core.js';

const DEFAULT_TTL=5*60*1000;
const MAX_TTL=15*60*1000;
const MAX_CREDENTIALS=8;
const MAX_ARGUMENT_BYTES=64*1024;
const MAX_RESULT_BYTES=128*1024;

function text(value,fallback='',max=240){
  const out=String(value??fallback).trim();
  if(out.length>max) throw new Error(`Action broker text fields must be at most ${max} characters`);
  return out||fallback;
}
function ttl(value){
  const n=Number(value??DEFAULT_TTL);
  if(!Number.isFinite(n)||n<1000) throw new Error('Action TTL must be finite and at least 1000 ms');
  return Math.min(n,MAX_TTL);
}
function clone(value){ return structuredClone(value); }
function unique(values=[]){ return [...new Set((values??[]).map(value=>String(value)).filter(Boolean))]; }
function credentialLikeHits(value){
  const raw=JSON.stringify(value??{});
  return detectSensitive(raw).filter(hit=>hit.type!=='email');
}
function replaceExactSecrets(value,secrets){
  if(value==null) return value;
  if(typeof value==='string'){
    let out=value;
    for(const secret of secrets){
      const s=String(secret??'');
      if(s) out=out.split(s).join('[HUSH:CREDENTIAL]');
    }
    const hits=detectSensitive(out).filter(hit=>hit.type!=='email');
    for(const hit of hits.sort((a,b)=>b.start-a.start)) out=out.slice(0,hit.start)+'[HUSH:CREDENTIAL]'+out.slice(hit.end);
    return out;
  }
  if(Array.isArray(value)) return value.map(item=>replaceExactSecrets(item,secrets));
  if(typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=replaceExactSecrets(item,secrets);
    return out;
  }
  return value;
}
function safeReceipt(ticket,result,status,now){
  const body={
    v:1,
    id:`actrcpt_${crypto.randomBytes(18).toString('base64url')}`,
    at:now,
    actionId:ticket.id,
    requestHash:ticket.requestHash,
    agent:ticket.agent,
    sink:ticket.sink,
    purpose:ticket.purpose,
    category:ticket.category,
    adapter:ticket.adapter,
    action:ticket.action,
    resource:ticket.resource,
    status,
    credentialCount:ticket.credentialRefs.length,
    rawCredentialIncluded:false,
    resultDigest:result===undefined?null:sha256(canonicalize(result))
  };
  return {...body,hash:sha256(canonicalize(body))};
}
function consentRequest(ticket){
  return {
    capability:`action:${ticket.adapter}:${ticket.action}`,
    agent:ticket.agent,
    sink:ticket.sink,
    purpose:ticket.purpose,
    category:ticket.category,
    resource:ticket.resource
  };
}
function safeTicket(ticket){
  return {
    actionId:ticket.id,
    decision:ticket.deniedAt?'deny':ticket.consumedAt?'consumed':ticket.approvedAt?'allow':ticket.consent?.decision==='allow'?'allow':'ask',
    reason:ticket.deniedAt?'Action was denied.':ticket.consumedAt?'Action ticket was already consumed.':ticket.approvedAt?'Action was approved locally.':ticket.consent?.reason??'Action requires approval.',
    agent:ticket.agent,
    sink:ticket.sink,
    purpose:ticket.purpose,
    category:ticket.category,
    adapter:ticket.adapter,
    action:ticket.action,
    resource:ticket.resource,
    argumentKeys:Object.keys(ticket.arguments??{}).sort(),
    credentialCount:ticket.credentialRefs.length,
    createdAt:ticket.createdAt,
    expiresAt:ticket.expiresAt,
    approvedAt:ticket.approvedAt,
    deniedAt:ticket.deniedAt,
    consumedAt:ticket.consumedAt,
    requestHash:ticket.requestHash,
    consent:ticket.consent??null,
    rawCredentialIncluded:false
  };
}

/**
 * Local action brokerage for Hush. AI clients describe an action and may reference
 * opaque credential handles, but never receive credential values. Adapters are
 * registered by trusted local application code, not by AI-facing tools.
 */
export class ActionBroker {
  constructor({consentRegistry=null,secretResolver=null,now=()=>Date.now()}={}){
    this.consentRegistry=consentRegistry;
    this.secretResolver=secretResolver;
    this.now=now;
    this.adapters=new Map();
    this.tickets=new Map();
    this.receipts=[];
  }

  registerAdapter({name,actions=['*'],execute,description=''}={}){
    const id=text(name,'',120);
    if(!id) throw new Error('Action adapter name is required');
    if(typeof execute!=='function') throw new Error('Action adapter execute function is required');
    const normalized={name:id,actions:unique(actions).sort(),execute,description:text(description,'',240)};
    if(!normalized.actions.length) throw new Error('Action adapter must declare at least one supported action');
    this.adapters.set(id,normalized);
    return {name:normalized.name,actions:[...normalized.actions],description:normalized.description};
  }

  removeAdapter(name){ return this.adapters.delete(String(name)); }
  listAdapters(){ return [...this.adapters.values()].map(({execute,...adapter})=>clone(adapter)).sort((a,b)=>a.name.localeCompare(b.name)); }

  _adapter(name,action){
    const adapter=this.adapters.get(String(name));
    if(!adapter) throw new Error('Action adapter is not registered locally');
    if(!adapter.actions.includes('*')&&!adapter.actions.includes(String(action))) throw new Error('Action is outside the adapter scope');
    return adapter;
  }

  request({adapter,action,agent='unknown-agent',sink='unknown-sink',purpose='unspecified',category='general',resource='*',arguments:args={},credentialRefs=[],ttlMs=DEFAULT_TTL}={}){
    const adapterName=text(adapter,'',120);
    const actionName=text(action,'',160);
    if(!adapterName||!actionName) throw new Error('adapter and action are required');
    this._adapter(adapterName,actionName);

    const argumentsCopy=clone(args??{});
    const argumentBytes=Buffer.byteLength(JSON.stringify(argumentsCopy));
    if(argumentBytes>MAX_ARGUMENT_BYTES) throw new Error('Action arguments exceed the broker limit');
    const rawCredentialHits=credentialLikeHits(argumentsCopy);
    if(rawCredentialHits.length){
      return {
        decision:'deny',hardDeny:true,
        reason:'Raw credential material must not be placed in action arguments. Use an opaque Hush credential reference.',
        detected:rawCredentialHits.map(({value,...hit})=>hit),rawCredentialIncluded:true
      };
    }

    const refs=unique(credentialRefs);
    if(refs.length>MAX_CREDENTIALS) throw new Error(`At most ${MAX_CREDENTIALS} credential references may be attached to one action`);
    const now=this.now();
    const ticket={
      id:`action_${crypto.randomBytes(24).toString('base64url')}`,
      adapter:adapterName,action:actionName,
      agent:text(agent,'unknown-agent'),sink:text(sink,'unknown-sink'),purpose:text(purpose,'unspecified'),category:text(category,'general'),resource:text(resource,'*'),
      arguments:argumentsCopy,credentialRefs:refs,
      createdAt:now,expiresAt:now+ttl(ttlMs),approvedAt:null,deniedAt:null,consumedAt:null,attemptedAt:null,receipt:null,consent:null,requestHash:null
    };
    ticket.requestHash=sha256(canonicalize({
      adapter:ticket.adapter,action:ticket.action,agent:ticket.agent,sink:ticket.sink,purpose:ticket.purpose,category:ticket.category,resource:ticket.resource,
      arguments:ticket.arguments,credentialRefs:ticket.credentialRefs.map(ref=>sha256(String(ref)))
    }));

    if(this.consentRegistry){
      const verdict=this.consentRegistry.evaluate(consentRequest(ticket),{consume:false});
      ticket.consent={decision:verdict.decision,reason:verdict.reason,ruleId:verdict.rule?.id??null,mode:verdict.rule?.mode??null};
      if(verdict.decision==='deny') ticket.deniedAt=now;
    }
    this.tickets.set(ticket.id,ticket);
    return safeTicket(ticket);
  }

  _ticket(id){
    const ticket=this.tickets.get(String(id));
    if(!ticket) throw new Error('Action ticket not found');
    if(this.now()>=ticket.expiresAt){
      this.tickets.delete(ticket.id);
      throw new Error('Action ticket expired');
    }
    return ticket;
  }

  queue(){
    const now=this.now();
    for(const [id,ticket] of this.tickets) if(now>=ticket.expiresAt) this.tickets.delete(id);
    return [...this.tickets.values()].map(safeTicket).sort((a,b)=>b.createdAt-a.createdAt);
  }

  approve(id){
    const ticket=this._ticket(id);
    if(ticket.deniedAt) throw new Error('Action ticket was denied');
    if(ticket.consumedAt||ticket.attemptedAt) throw new Error('Action ticket was already consumed');
    if(!ticket.approvedAt) ticket.approvedAt=this.now();
    return safeTicket(ticket);
  }

  deny(id){
    const ticket=this._ticket(id);
    if(ticket.consumedAt||ticket.attemptedAt) throw new Error('Action ticket was already consumed');
    ticket.deniedAt=this.now();
    return safeTicket(ticket);
  }

  async execute({actionId,agent='unknown-agent',sink='unknown-sink'}={}){
    const ticket=this._ticket(actionId);
    if(ticket.agent!==String(agent)||ticket.sink!==String(sink)) throw new Error('Action ticket is bound to another agent or sink');
    if(ticket.deniedAt) return safeTicket(ticket);
    if(ticket.attemptedAt||ticket.consumedAt) throw new Error('Action ticket was already consumed');

    if(!ticket.approvedAt){
      if(!this.consentRegistry) return safeTicket(ticket);
      const verdict=this.consentRegistry.evaluate(consentRequest(ticket),{consume:true});
      ticket.consent={decision:verdict.decision,reason:verdict.reason,ruleId:verdict.rule?.id??null,mode:verdict.rule?.mode??null};
      if(verdict.decision==='deny'){ ticket.deniedAt=this.now(); return safeTicket(ticket); }
      if(verdict.decision!=='allow') return safeTicket(ticket);
    }

    const adapter=this._adapter(ticket.adapter,ticket.action);
    const credentials=[];
    if(ticket.credentialRefs.length){
      if(typeof this.secretResolver!=='function') throw new Error('No local credential resolver is configured');
      for(const ref of ticket.credentialRefs) credentials.push(await this.secretResolver(ref));
    }

    ticket.attemptedAt=this.now();
    try{
      const rawResult=await adapter.execute({
        action:ticket.action,
        arguments:clone(ticket.arguments),
        credentials:[...credentials],
        request:{agent:ticket.agent,sink:ticket.sink,purpose:ticket.purpose,category:ticket.category,resource:ticket.resource,requestHash:ticket.requestHash}
      });
      let result=replaceExactSecrets(clone(rawResult),credentials);
      const bytes=Buffer.byteLength(JSON.stringify(result));
      if(bytes>MAX_RESULT_BYTES) result={truncated:true,reason:'Action result exceeded the Hush broker output limit.',digest:sha256(canonicalize(result))};
      ticket.consumedAt=this.now();
      ticket.receipt=safeReceipt(ticket,result,'allow',ticket.consumedAt);
      this.receipts.push(ticket.receipt);
      return {decision:'allow',result,receipt:clone(ticket.receipt),rawCredentialIncluded:false};
    }catch(error){
      ticket.consumedAt=this.now();
      ticket.receipt=safeReceipt(ticket,undefined,'error',ticket.consumedAt);
      this.receipts.push(ticket.receipt);
      return {decision:'error',reason:error?.message||'Action execution failed.',receipt:clone(ticket.receipt),rawCredentialIncluded:false};
    }
  }

  receiptLog(){ return this.receipts.map(clone); }
}
