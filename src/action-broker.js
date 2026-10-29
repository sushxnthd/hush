import crypto from 'node:crypto';
import fs from 'node:fs';
import {atomicWriteJson,canonicalize,decryptJson,detectSensitive,encryptJson,sha256} from './core.js';
import {certifyCumulativeAuthorization} from './cumulative-authorization-contract.js';
import {certifyLifecycleTraceAuthorization} from './lifecycle-trace-contract.js';
import {certifyObservableClosure} from './observable-closure-contract.js';

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
function iso(value){ return value==null?null:new Date(value).toISOString(); }
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
    const out=Object.create(null);
    for(const [key,item] of Object.entries(value)){
      const safeKey=replaceExactSecrets(key,secrets);
      if(Object.hasOwn(out,safeKey)) throw new Error('Result keys collide after credential redaction');
      out[safeKey]=replaceExactSecrets(item,secrets);
    }
    return out;
  }
  return value;
}
function safeReceipt(ticket,result,status,now){
  const body={
    v:1,
    id:`actrcpt_${crypto.randomBytes(18).toString('base64url')}`,
    at:iso(now),
    actionId:ticket.id,
    requestHash:ticket.requestHash,
    agent:ticket.agent,
    sink:ticket.sink,
    purpose:ticket.purpose,
    category:ticket.category,
    adapter:ticket.adapter,
    action:ticket.action,
    resource:ticket.resource,
    transactionId:ticket.transactionId,
    globalAuthorizationCommitment:ticket.globalAuthorizationCommitment,
    localAuthorizationCommitment:ticket.localAuthorizationCommitment,
    ...(ticket.requireLifecycleTraceCertificate?{
      lifecycleTraceCommitment:ticket.lifecycleTraceCommitment,
      lifecycleTraceDecision:ticket.lifecycleTraceDecision
    }:{}),
    ...(ticket.requireObservableClosureCertificate?{
      observableClosureCommitment:ticket.observableClosureCommitment,
      observableClosureDecision:ticket.observableClosureDecision
    }:{}),
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
    reason:ticket.deniedAt?(ticket.denialReason??'Action was denied.'):ticket.consumedAt?'Action ticket was already consumed.':ticket.approvedAt?'Action was approved locally.':ticket.consent?.reason??'Action requires approval.',
    agent:ticket.agent,
    sink:ticket.sink,
    purpose:ticket.purpose,
    category:ticket.category,
    adapter:ticket.adapter,
    action:ticket.action,
    resource:ticket.resource,
    transactionId:ticket.transactionId,
    globalAuthorizationCommitment:ticket.globalAuthorizationCommitment,
    localAuthorizationCommitment:ticket.localAuthorizationCommitment,
    authorizationScopeDecision:ticket.authorizationScopeDecision,
    ...(ticket.requireLifecycleTraceCertificate?{
      requireLifecycleTraceCertificate:true,
      lifecycleTraceCommitment:ticket.lifecycleTraceCommitment,
      lifecycleTraceDecision:ticket.lifecycleTraceDecision
    }:{}),
    ...(ticket.requireObservableClosureCertificate?{
      requireObservableClosureCertificate:true,
      observableClosureCommitment:ticket.observableClosureCommitment,
      observableClosureDecision:ticket.observableClosureDecision
    }:{}),
    argumentKeys:Object.keys(ticket.arguments??{}).sort(),
    credentialCount:ticket.credentialRefs.length,
    createdAt:iso(ticket.createdAt),
    expiresAt:iso(ticket.expiresAt),
    approvedAt:iso(ticket.approvedAt),
    deniedAt:iso(ticket.deniedAt),
    consumedAt:iso(ticket.consumedAt),
    requestHash:ticket.requestHash,
    consent:ticket.consent??null,
    rawCredentialIncluded:false
  };
}

export class EncryptedAuthorizationStateStore {
  constructor({file,key}={}){
    if(!String(file??'').trim()) throw new Error('Authorization state file is required');
    if(!Buffer.isBuffer(key)||key.length!==32) throw new Error('Authorization state key must be a 32-byte Buffer');
    this.file=String(file);
    this.key=key;
  }
  load(){
    if(!fs.existsSync(this.file)) return {v:1,transactions:[]};
    const state=decryptJson(JSON.parse(fs.readFileSync(this.file,'utf8')),this.key);
    if(state?.v!==1||!Array.isArray(state.transactions)) throw new Error('Invalid authorization transaction state');
    return state;
  }
  save(state){ atomicWriteJson(this.file,encryptJson(state,this.key)); }
  // HUSH-064: one local-filesystem writer at a time. An orphan lock remains
  // intentionally fail-closed until an authorized operator investigates it.
  // Never infer ownership from a PID or remove a lock because it looks old.
  withExclusiveLock(fn){
    const lockFile=this.file+'.lock';
    let fd;
    try{ fd=fs.openSync(lockFile,'wx',0o600); }
    catch(error){
      if(error?.code==='EEXIST') throw new Error('AUTHORIZATION_STATE_LOCKED');
      throw error;
    }
    try{
      fs.writeSync(fd,String(process.pid)+'\n');
      fs.fsyncSync(fd);
      return fn();
    }finally{
      try{ fs.closeSync(fd); }
      finally{ fs.unlinkSync(lockFile); }
    }
  }
}

/**
 * Local action brokerage for Hush. AI clients describe an action and may reference
 * opaque credential handles, but never receive credential values. Adapters are
 * registered by trusted local application code, not by AI-facing tools.
 */
export class ActionBroker {
  constructor({consentRegistry=null,secretResolver=null,now=()=>Date.now(),authorizationStateStore=null,observableBoundaries={}}={}){
    this.consentRegistry=consentRegistry;
    this.secretResolver=secretResolver;
    this.now=now;
    this.adapters=new Map();
    this.authorizationStateStore=authorizationStateStore;
    if(!observableBoundaries||typeof observableBoundaries!=='object'||Array.isArray(observableBoundaries)) throw new Error('observableBoundaries must be a broker-configured object');
    this.observableBoundaries=clone(observableBoundaries);
    this.authorizationTransactions=this._loadAuthorizationTransactions();
    // Track records known to have existed durably, so a missing state file
    // cannot silently be treated as a fresh empty store by this broker.
    this._knownDurableAuthorizationIds=new Set(this.authorizationTransactions.keys());
    this.tickets=new Map();
    this.receipts=[];
  }

  _loadAuthorizationTransactions(){
    const state=this.authorizationStateStore?.load?.();
    const records=state?.transactions??[];
    const transactions=new Map();
    for(const record of records){
      const id=text(record?.id,'',160);
      if(!id||transactions.has(id)) throw new Error('Invalid authorization transaction state');
      const worlds=clone(record.worlds);
      const globalAuthorization=clone(record.globalAuthorization);
      certifyCumulativeAuthorization({worlds,globalAuthorization,calls:[{id:'recovery',localAuthorization:globalAuthorization,observation:globalAuthorization}]});
      const commitment=sha256(canonicalize({v:1,transactionId:id,worlds,globalAuthorization}));
      if(commitment!==record.commitment) throw new Error('Authorization transaction commitment mismatch');
      const closedAt=record.closedAt==null?null:Number(record.closedAt);
      if(closedAt!=null&&!Number.isFinite(closedAt)) throw new Error('Invalid authorization transaction closure');
      transactions.set(id,{id,worlds,globalAuthorization,commitment,closedAt});
    }
    return transactions;
  }

  _persistAuthorizationTransactions(){
    if(!this.authorizationStateStore) return;
    // HUSH-062/064: reject stale-writer rollback while holding a cooperative
    // cross-process local-filesystem lock across the entire read/check/save.
    // This serializes map writes, NOT action dispatch or revocation versus
    // provider effects; it is not an end-to-end linearizable authorization gate.
    if(typeof this.authorizationStateStore.withExclusiveLock!=='function')
      throw new Error('AUTHORIZATION_STATE_ATOMICITY_UNSUPPORTED');
    return this.authorizationStateStore.withExclusiveLock(()=>{
      const durable=this.authorizationStateStore.load();
      if(durable?.v!==1||!Array.isArray(durable.transactions))
        throw new Error('AUTHORIZATION_STATE_STALE_WRITER_CONFLICT');
      const seen=new Set();
      for(const record of durable.transactions){
        if(!record||typeof record.id!=='string'||!record.id||
           seen.has(record.id)||!Object.hasOwn(record,'closedAt')||
           !(record.closedAt===null||(typeof record.closedAt==='number'&&Number.isFinite(record.closedAt))))
          throw new Error('AUTHORIZATION_STATE_STALE_WRITER_CONFLICT');
        seen.add(record.id);
        const local=this.authorizationTransactions.get(record.id);
        if(!local||local.commitment!==record.commitment||
           (record.closedAt!==null&&local.closedAt===null))
          throw new Error('AUTHORIZATION_STATE_STALE_WRITER_CONFLICT');
      }
      for(const id of this._knownDurableAuthorizationIds){
        if(!seen.has(id)) throw new Error('AUTHORIZATION_STATE_STALE_WRITER_CONFLICT');
      }
      const transactions=[...this.authorizationTransactions.values()]
        .sort((a,b)=>a.id.localeCompare(b.id)).map(clone);
      this.authorizationStateStore.save({v:1,transactions});
      this._knownDurableAuthorizationIds=new Set(transactions.map(x=>x.id));
    });
  }

  registerAdapter({name,actions=['*'],execute,description='',authorizationScopes={},lifecycleTraces={}}={}){
    const id=text(name,'',120);
    if(!id) throw new Error('Action adapter name is required');
    if(typeof execute!=='function') throw new Error('Action adapter execute function is required');
    if(!authorizationScopes||typeof authorizationScopes!=='object'||Array.isArray(authorizationScopes)) throw new Error('authorizationScopes must be an action-to-map object');
    if(!lifecycleTraces||typeof lifecycleTraces!=='object'||Array.isArray(lifecycleTraces)) throw new Error('lifecycleTraces must be an action-to-map object');
    const normalized={name:id,actions:unique(actions).sort(),execute,description:text(description,'',240),authorizationScopes:clone(authorizationScopes),lifecycleTraces:clone(lifecycleTraces)};
    if(!normalized.actions.length) throw new Error('Action adapter must declare at least one supported action');
    this.adapters.set(id,normalized);
    return {name:normalized.name,actions:[...normalized.actions],description:normalized.description};
  }

  removeAdapter(name){ return this.adapters.delete(String(name)); }
  listAdapters(){ return [...this.adapters.values()].map(({execute,authorizationScopes,lifecycleTraces,...adapter})=>clone(adapter)).sort((a,b)=>a.name.localeCompare(b.name)); }

  registerAuthorizationTransaction({transactionId,worlds,globalAuthorization}={}){
    const id=text(transactionId,'',160);
    if(!id) throw new Error('transactionId is required');
    const worldsCopy=clone(worlds);
    const globalCopy=clone(globalAuthorization);
    certifyCumulativeAuthorization({worlds:worldsCopy,globalAuthorization:globalCopy,calls:[{id:'registration',localAuthorization:globalCopy,observation:globalCopy}]});
    const commitment=sha256(canonicalize({v:1,transactionId:id,worlds:worldsCopy,globalAuthorization:globalCopy}));
    const existing=this.authorizationTransactions.get(id);
    if(existing){
      if(existing.commitment!==commitment) throw new Error('Authorization transaction ids are immutable');
      if(existing.closedAt) throw new Error('Authorization transaction is closed');
      return {transactionId:id,globalAuthorizationCommitment:commitment,closed:false};
    }
    this.authorizationTransactions.set(id,{id,worlds:worldsCopy,globalAuthorization:globalCopy,commitment,closedAt:null});
    try{ this._persistAuthorizationTransactions(); }
    catch(error){ this.authorizationTransactions.delete(id); throw error; }
    return {transactionId:id,globalAuthorizationCommitment:commitment,closed:false};
  }

  closeAuthorizationTransaction(transactionId){
    const transaction=this.authorizationTransactions.get(String(transactionId));
    if(!transaction) throw new Error('Authorization transaction not found');
    if(!transaction.closedAt){
      const before=transaction.closedAt;
      transaction.closedAt=this.now();
      try{ this._persistAuthorizationTransactions(); }
      catch(error){ transaction.closedAt=before; throw error; }
    }
    return {transactionId:transaction.id,globalAuthorizationCommitment:transaction.commitment,closed:true};
  }

  _observableBoundary(adapter,action){
    return clone(this.observableBoundaries[String(adapter)]?.[String(action)]??this.observableBoundaries[String(adapter)]?.['*']??null);
  }

  _adapter(name,action){
    const adapter=this.adapters.get(String(name));
    if(!adapter) throw new Error('Action adapter is not registered locally');
    if(!adapter.actions.includes('*')&&!adapter.actions.includes(String(action))) throw new Error('Action is outside the adapter scope');
    return adapter;
  }

  request({adapter,action,agent='unknown-agent',sink='unknown-sink',purpose='unspecified',category='general',resource='*',arguments:args={},credentialRefs=[],ttlMs=DEFAULT_TTL,transactionId=null,requireLifecycleTraceCertificate=false,requireObservableClosureCertificate=false}={}){
    const adapterName=text(adapter,'',120);
    const actionName=text(action,'',160);
    if(!adapterName||!actionName) throw new Error('adapter and action are required');
    const trustedAdapter=this._adapter(adapterName,actionName);

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
    let transaction=null;
    let localAuthorization=null;
    let localAuthorizationCommitment=null;
    let authorizationScopeDecision=null;
    let lifecycleTrace=null;
    let lifecycleTraceCommitment=null;
    let lifecycleTraceDecision=null;
    let observableBoundary=null;
    let observableClosureCommitment=null;
    let observableClosureDecision=null;
    if(transactionId!=null){
      transaction=this.authorizationTransactions.get(String(transactionId));
      if(!transaction) throw new Error('Authorization transaction not found');
      if(transaction.closedAt) throw new Error('Authorization transaction is closed');
      localAuthorization=clone(trustedAdapter.authorizationScopes[actionName]??trustedAdapter.authorizationScopes['*']??null);
      if(localAuthorization){
        localAuthorizationCommitment=sha256(canonicalize({v:1,adapter:adapterName,action:actionName,localAuthorization}));
        try{
          const certificate=certifyCumulativeAuthorization({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,calls:[{id:actionName,localAuthorization,observation:localAuthorization}]});
          authorizationScopeDecision=certificate.safe?'allow':'deny';
        }catch{ authorizationScopeDecision='deny'; }
      }else authorizationScopeDecision='deny';
      if(requireLifecycleTraceCertificate){
        lifecycleTrace=clone(trustedAdapter.lifecycleTraces[actionName]??trustedAdapter.lifecycleTraces['*']??null);
        if(lifecycleTrace){
          lifecycleTraceCommitment=sha256(canonicalize({v:1,adapter:adapterName,action:actionName,lifecycleTrace}));
          try{ lifecycleTraceDecision=certifyLifecycleTraceAuthorization({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,traces:lifecycleTrace}).safe?'allow':'deny'; }
          catch{ lifecycleTraceDecision='deny'; }
        }else lifecycleTraceDecision='deny';
      }
      if(requireObservableClosureCertificate){
        observableBoundary=this._observableBoundary(adapterName,actionName);
        try{
          const certificate=certifyObservableClosure({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,...observableBoundary});
          observableClosureDecision=certificate.safe?'allow':'deny';
          observableClosureCommitment=certificate.safe?certificate.commitment:null;
        }catch{ observableClosureDecision='deny'; }
      }
    }
    const ticket={
      id:`action_${crypto.randomBytes(24).toString('base64url')}`,
      adapter:adapterName,action:actionName,
      agent:text(agent,'unknown-agent'),sink:text(sink,'unknown-sink'),purpose:text(purpose,'unspecified'),category:text(category,'general'),resource:text(resource,'*'),
      arguments:argumentsCopy,credentialRefs:refs,
      transactionId:transaction?.id??null,
      globalAuthorizationCommitment:transaction?.commitment??null,
      localAuthorizationCommitment,
      localAuthorization,
      authorizationScopeDecision,
      requireLifecycleTraceCertificate:Boolean(requireLifecycleTraceCertificate),
      lifecycleTrace,
      lifecycleTraceCommitment,
      lifecycleTraceDecision,
      requireObservableClosureCertificate:Boolean(requireObservableClosureCertificate),
      observableBoundary,
      observableClosureCommitment,
      observableClosureDecision,
      createdAt:now,expiresAt:now+ttl(ttlMs),approvedAt:null,deniedAt:null,denialReason:null,consumedAt:null,attemptedAt:null,receipt:null,consent:null,requestHash:null
    };
    const requestBinding={
      adapter:ticket.adapter,action:ticket.action,agent:ticket.agent,sink:ticket.sink,purpose:ticket.purpose,category:ticket.category,resource:ticket.resource,
      arguments:ticket.arguments,credentialRefs:ticket.credentialRefs.map(ref=>sha256(String(ref)))
    };
    if(ticket.transactionId){
      requestBinding.transactionId=ticket.transactionId;
      requestBinding.globalAuthorizationCommitment=ticket.globalAuthorizationCommitment;
      requestBinding.localAuthorizationCommitment=ticket.localAuthorizationCommitment;
      if(ticket.requireLifecycleTraceCertificate){
        requestBinding.requireLifecycleTraceCertificate=true;
        requestBinding.lifecycleTraceCommitment=ticket.lifecycleTraceCommitment;
      }
      if(ticket.requireObservableClosureCertificate){
        requestBinding.requireObservableClosureCertificate=true;
        requestBinding.observableClosureCommitment=ticket.observableClosureCommitment;
      }
    }
    ticket.requestHash=sha256(canonicalize(requestBinding));

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
    return [...this.tickets.values()].sort((a,b)=>b.createdAt-a.createdAt).map(safeTicket);
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

  _scopeVerdict(ticket){
    // A ticket can expire while asynchronous credential resolution is pending.
    // Re-evaluate at every pre-dispatch scope check, including unscoped actions.
    if(this.now()>=ticket.expiresAt) return {safe:false,reason:'ACTION_TICKET_EXPIRED'};
    if(!ticket.transactionId) return {safe:true,reason:'UNSCOPED'};
    // HUSH-061: a different broker may have durably revoked this transaction
    // while this instance was awaiting credentials or an HTTP adapter. The
    // in-memory map alone is not a revocation authority across instances.
    // This synchronous read is fail-closed but NOT a linearizable revocation
    // protocol: another writer can close immediately after the final read.
    if(this.authorizationStateStore){
      let persisted;
      try{
        const state=this.authorizationStateStore.load();
        if(state?.v!==1||!Array.isArray(state.transactions))
          return {safe:false,reason:'AUTHORIZATION_STATE_INVALID'};
        const matches=state.transactions.filter(record=>record?.id===ticket.transactionId);
        if(matches.length!==1)
          return {safe:false,reason:'AUTHORIZATION_STATE_TRANSACTION_MISSING_OR_DUPLICATED'};
        persisted=matches[0];
        if(!Object.hasOwn(persisted,'closedAt'))
          return {safe:false,reason:'AUTHORIZATION_STATE_INVALID'};
        if(persisted.closedAt!==null)
          return {safe:false,reason:'AUTHORIZATION_TRANSACTION_CLOSED'};
        const durableCommitment=sha256(canonicalize({
          v:1,transactionId:persisted.id,
          worlds:persisted.worlds,globalAuthorization:persisted.globalAuthorization
        }));
        if(durableCommitment!==persisted.commitment||
           persisted.commitment!==ticket.globalAuthorizationCommitment)
          return {safe:false,reason:'DURABLE_AUTHORIZATION_COMMITMENT_MISMATCH'};
      }catch{
        return {safe:false,reason:'AUTHORIZATION_STATE_UNAVAILABLE'};
      }
    }
    const transaction=this.authorizationTransactions.get(ticket.transactionId);
    if(!transaction) return {safe:false,reason:'AUTHORIZATION_TRANSACTION_MISSING'};
    if(transaction.closedAt) return {safe:false,reason:'AUTHORIZATION_TRANSACTION_CLOSED'};
    const currentGlobalCommitment=sha256(canonicalize({v:1,transactionId:transaction.id,worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization}));
    if(currentGlobalCommitment!==transaction.commitment||transaction.commitment!==ticket.globalAuthorizationCommitment) return {safe:false,reason:'GLOBAL_AUTHORIZATION_COMMITMENT_MISMATCH'};
    const adapter=this._adapter(ticket.adapter,ticket.action);
    const currentLocal=adapter.authorizationScopes[ticket.action]??adapter.authorizationScopes['*']??null;
    if(!currentLocal) return {safe:false,reason:'LOCAL_AUTHORIZATION_SCOPE_MISSING'};
    const currentCommitment=sha256(canonicalize({v:1,adapter:ticket.adapter,action:ticket.action,localAuthorization:currentLocal}));
    const snapshotCommitment=sha256(canonicalize({v:1,adapter:ticket.adapter,action:ticket.action,localAuthorization:ticket.localAuthorization}));
    if(currentCommitment!==ticket.localAuthorizationCommitment||snapshotCommitment!==ticket.localAuthorizationCommitment) return {safe:false,reason:'LOCAL_AUTHORIZATION_COMMITMENT_MISMATCH'};
    if(ticket.requireLifecycleTraceCertificate){
      const currentTrace=adapter.lifecycleTraces[ticket.action]??adapter.lifecycleTraces['*']??null;
      if(!currentTrace) return {safe:false,reason:'LIFECYCLE_TRACE_SCOPE_MISSING'};
      const currentTraceCommitment=sha256(canonicalize({v:1,adapter:ticket.adapter,action:ticket.action,lifecycleTrace:currentTrace}));
      const snapshotTraceCommitment=sha256(canonicalize({v:1,adapter:ticket.adapter,action:ticket.action,lifecycleTrace:ticket.lifecycleTrace}));
      if(currentTraceCommitment!==ticket.lifecycleTraceCommitment||snapshotTraceCommitment!==ticket.lifecycleTraceCommitment) return {safe:false,reason:'LIFECYCLE_TRACE_COMMITMENT_MISMATCH'};
      try{
        const lifecycle=certifyLifecycleTraceAuthorization({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,traces:ticket.lifecycleTrace});
        if(!lifecycle.safe) return {safe:false,reason:lifecycle.reason,witness:lifecycle.witness};
      }catch{ return {safe:false,reason:'LIFECYCLE_TRACE_SCOPE_INVALID'}; }
    }
    if(ticket.requireObservableClosureCertificate){
      const currentBoundary=this._observableBoundary(ticket.adapter,ticket.action);
      if(!currentBoundary) return {safe:false,reason:'OBSERVABLE_CLOSURE_INCOMPLETE'};
      try{
        const certificate=certifyObservableClosure({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,...currentBoundary});
        if(!certificate.safe) return {safe:false,reason:certificate.reason,witness:certificate.witness};
        if(!ticket.observableBoundary||certificate.commitment!==ticket.observableClosureCommitment) return {safe:false,reason:'OBSERVABLE_CLOSURE_COMMITMENT_MISMATCH'};
        const snapshot=certifyObservableClosure({worlds:transaction.worlds,globalAuthorization:transaction.globalAuthorization,...ticket.observableBoundary});
        if(!snapshot.safe||snapshot.commitment!==ticket.observableClosureCommitment) return {safe:false,reason:'OBSERVABLE_CLOSURE_COMMITMENT_MISMATCH'};
      }catch{ return {safe:false,reason:'OBSERVABLE_CLOSURE_INVALID'}; }
    }
    try{
      const certificate=certifyCumulativeAuthorization({
        worlds:transaction.worlds,
        globalAuthorization:transaction.globalAuthorization,
        calls:[{id:ticket.action,localAuthorization:ticket.localAuthorization,observation:ticket.localAuthorization}]
      });
      return certificate.safe?{safe:true,reason:'CERTIFIED'}:{safe:false,reason:certificate.reason,witness:certificate.witness};
    }catch{ return {safe:false,reason:'AUTHORIZATION_SCOPE_INVALID'}; }
  }

  _denyBeforeDispatch(ticket,verdict){
    ticket.deniedAt=this.now();
    ticket.consumedAt=ticket.deniedAt;
    ticket.denialReason=`Transaction authorization denied before dispatch: ${verdict.reason}`;
    ticket.receipt=safeReceipt(ticket,undefined,'deny',ticket.deniedAt);
    this.receipts.push(ticket.receipt);
    return {decision:'deny',reason:ticket.denialReason,witness:verdict.witness??null,receipt:clone(ticket.receipt),rawCredentialIncluded:false};
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

    const scopeVerdict=this._scopeVerdict(ticket);
    if(!scopeVerdict.safe) return this._denyBeforeDispatch(ticket,scopeVerdict);

    const adapter=this._adapter(ticket.adapter,ticket.action);
    // Synchronously reserve the one-use ticket before any await. Otherwise two
    // concurrent execute() calls can both pass the initial attemptedAt guard.
    ticket.attemptedAt=this.now();
    const credentials=[];
    try{
      if(ticket.credentialRefs.length){
        if(typeof this.secretResolver!=='function') throw new Error('No local credential resolver is configured');
        for(const ref of ticket.credentialRefs) credentials.push(await this.secretResolver(ref));
      }
      // Credential resolution is asynchronous. Transaction closure or a scope
      // change during that await must be checked again before adapter dispatch.
      const dispatchVerdict=this._scopeVerdict(ticket);
      if(!dispatchVerdict.safe) return this._denyBeforeDispatch(ticket,dispatchVerdict);
      const rawResult=await adapter.execute({
        action:ticket.action,
        arguments:clone(ticket.arguments),
        credentials:[...credentials],
        request:{agent:ticket.agent,sink:ticket.sink,purpose:ticket.purpose,category:ticket.category,resource:ticket.resource,requestHash:ticket.requestHash}
      });
      // HUSH-060: authorization can be revoked while an asynchronous adapter
      // is awaiting a provider response. Do not release, redact, serialize or
      // hash its private result until scope is revalidated at completion.
      // This only gates broker-to-agent output; provider effects are irreversible.
      const completionVerdict=this._scopeVerdict(ticket);
      if(!completionVerdict.safe){
        const at=this.now();
        ticket.deniedAt=at;
        ticket.consumedAt=at;
        ticket.denialReason='Action result suppressed after dispatch because authorization is no longer valid; external effects may have occurred.';
        ticket.receipt=safeReceipt(ticket,undefined,'deny',at);
        this.receipts.push(ticket.receipt);
        return {decision:'deny',reason:ticket.denialReason,
          receipt:clone(ticket.receipt),rawCredentialIncluded:false};
      }
      let result=replaceExactSecrets(clone(rawResult),credentials);
      const bytes=Buffer.byteLength(JSON.stringify(result));
      // Suppressed private result content must not reappear as a digest oracle.
      // The receipt hashes only the public, truncated projection below.
      if(bytes>MAX_RESULT_BYTES) result={truncated:true,reason:'Action result exceeded the Hush broker output limit.'};
      ticket.consumedAt=this.now();
      ticket.receipt=safeReceipt(ticket,result,'allow',ticket.consumedAt);
      this.receipts.push(ticket.receipt);
      return {decision:'allow',result,receipt:clone(ticket.receipt),rawCredentialIncluded:false};
    }catch(error){
      ticket.consumedAt=this.now();
      ticket.receipt=safeReceipt(ticket,undefined,'error',ticket.consumedAt);
      this.receipts.push(ticket.receipt);
      // Adapter/credential-resolver exceptions are untrusted and may contain secrets.
      return {decision:'error',reason:'Action execution failed.',receipt:clone(ticket.receipt),rawCredentialIncluded:false};
    }
  }

  receiptLog(){ return this.receipts.map(clone); }
}
