import {readResponseText} from './response-io.js';
const DEFAULT_BASE_URL='http://127.0.0.1:8787';
const LOOPBACK_HOSTS=new Set(['127.0.0.1','localhost','[::1]','::1']);
const MAX_TEXT_BYTES=256*1024;

function byteLength(value){ return new TextEncoder().encode(String(value??'')).byteLength; }
function cleanBaseUrl(value,{allowRemote=false}={}){
  const url=new URL(String(value||DEFAULT_BASE_URL));
  if(!['http:','https:'].includes(url.protocol)) throw new Error('Hush client endpoint must use http or https');
  if(url.username||url.password)throw new Error('Hush credentials must not be embedded in endpoint URLs');
  if(!allowRemote&&!LOOPBACK_HOSTS.has(url.hostname)) throw new Error('Remote Hush endpoints are disabled by default; use an authenticated transport before enabling them');
  url.pathname='/';
  url.search='';
  url.hash='';
  return url;
}
function pathUrl(base,path){
  const url=new URL(String(path).replace(/^\//,''),base);
  if(url.origin!==base.origin||url.username||url.password)throw new HushClientError('Hush request paths must stay on the configured endpoint');
  return url;
}
function clone(value){ return structuredClone(value); }
function providerName(value){
  const provider=String(value??'').toLowerCase();
  if(!['google','github'].includes(provider)) throw new HushClientError('provider must be google or github');
  return provider;
}
function requiredId(value,name){
  const id=String(value??'').trim();
  if(!id) throw new HushClientError(`${name} is required`);
  return encodeURIComponent(id);
}

export class HushClientError extends Error {
  constructor(message,{status=null,payload=null}={}){
    super(message);
    this.name='HushClientError';
    this.status=status;
    this.payload=payload;
  }
}

/**
 * Dependency-free client shared by browser-extension, desktop and mobile shells.
 * It defaults to loopback only. Native production clients should provide the
 * OS-root-derived authToken; browser extensions use the exact registered origin
 * or Native Messaging boundary instead of storing this control credential.
 */
export class HushClient {
  constructor({baseUrl=DEFAULT_BASE_URL,fetchImpl=globalThis.fetch,allowRemote=false,timeoutMs=5000,authToken=null}={}){
    if(typeof fetchImpl!=='function') throw new Error('HushClient requires fetch');
    const timeout=Number(timeoutMs);
    if(!Number.isFinite(timeout)||timeout<100||timeout>120000) throw new Error('timeoutMs must be between 100 and 120000');
    this.baseUrl=cleanBaseUrl(baseUrl,{allowRemote});
    this.fetchImpl=fetchImpl;
    this.timeoutMs=timeout;
    this.authToken=authToken==null?null:String(authToken).trim();
  }

  async request(path,{method='GET',body=undefined,signal=undefined}={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(new Error('Hush request timed out')),this.timeoutMs);
    const relayAbort=()=>controller.abort(signal?.reason);
    if(signal){
      if(signal.aborted) relayAbort();
      else signal.addEventListener('abort',relayAbort,{once:true});
    }
    try{
      const headers={accept:'application/json'};
      if(this.authToken) headers.authorization=`Hush ${this.authToken}`;
      const options={method:String(method).toUpperCase(),signal:controller.signal,headers,redirect:'error'};
      if(body!==undefined){
        options.headers['content-type']='application/json';
        options.body=JSON.stringify(body);
        if(byteLength(options.body)>1_000_000)throw new HushClientError('Hush request exceeded the client safety limit');
      }
      const response=await this.fetchImpl(pathUrl(this.baseUrl,path),options);
      const raw=await readResponseText(response,MAX_TEXT_BYTES);
      let payload={};
      if(raw){
        try{ payload=JSON.parse(raw); }
        catch{ throw new HushClientError('Hush returned invalid JSON',{status:response.status}); }
      }
      if(!response.ok&&response.status!==202){
        throw new HushClientError(payload.error||payload.reason||`Hush request failed (${response.status})`,{status:response.status,payload});
      }
      return clone(payload);
    } catch(error){
      if(error instanceof HushClientError) throw error;
      if(controller.signal.aborted) throw new HushClientError('Hush request was cancelled or timed out');
      throw new HushClientError(error?.message||'Unable to reach the local Hush runtime');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener?.('abort',relayAbort);
    }
  }

  status(){ return this.request('/api/status'); }
  pending(){ return this.request('/api/pending'); }
  receipts(){ return this.request('/api/receipts'); }
  footprint(){ return this.request('/api/privacy/footprint'); }
  trust(){ return this.request('/api/privacy/trust'); }
  vaultInventory(){ return this.request('/api/vault'); }
  contextInventory(){ return this.request('/api/context'); }
  onboardingStatus(){ return this.request('/api/onboarding/status'); }
  actions(){ return this.request('/api/onboarding/actions'); }
  actionReceipts(){ return this.request('/api/onboarding/actions/receipts'); }
  dashboardLaunch(){ return this.request('/api/dashboard/launch',{method:'POST',body:{}}); }

  redact(text){
    const value=String(text??'');
    if(byteLength(value)>MAX_TEXT_BYTES) throw new HushClientError('Text is too large to redact in one request');
    return this.request('/api/redact',{method:'POST',body:{text:value}});
  }

  approve(pendingId){
    const id=requiredId(pendingId,'pendingId');
    return this.request(`/api/pending/${id}/approve`,{method:'POST',body:{}});
  }

  deny(pendingId){
    const id=requiredId(pendingId,'pendingId');
    return this.request(`/api/pending/${id}/deny`,{method:'POST',body:{}});
  }

  setTrust(agent,level){
    return this.request('/api/privacy/trust',{method:'POST',body:{agent:String(agent),level:String(level)}});
  }

  startGoogle(connectors=[],actions=[]){
    if(!(connectors?.length||actions?.length)) throw new HushClientError('Select at least one Google connector or action before requesting consent');
    return this.request('/api/onboarding/google/start',{method:'POST',body:{connectors:[...connectors],actions:[...actions]}});
  }

  startGithub(){
    return this.request('/api/onboarding/github/start',{method:'POST',body:{}});
  }

  pollGithub(sessionId){
    const id=String(sessionId??'').trim();
    if(!id) throw new HushClientError('sessionId is required');
    return this.request('/api/onboarding/github/poll',{method:'POST',body:{sessionId:id}});
  }

  syncProvider(provider,{connectors=undefined,limit=50}={}){
    const name=providerName(provider);
    return this.request(`/api/onboarding/${name}/sync`,{method:'POST',body:{connectors,limit}});
  }

  disconnectProvider(provider){
    const name=providerName(provider);
    return this.request(`/api/onboarding/${name}/disconnect`,{method:'POST',body:{}});
  }

  async requestAction({provider='google',action,agent='unknown-agent',sink=null,purpose='unspecified',category=null,resource='me',arguments:args={}}={}){
    if(!String(action??'').trim()) throw new HushClientError('action is required');
    try{
      return await this.request('/api/onboarding/actions/request',{method:'POST',body:{provider,action,agent,sink,purpose,category,resource,arguments:args}});
    }catch(error){
      if(error instanceof HushClientError&&error.status===409&&error.payload?.decision==='reauthorize') return clone(error.payload);
      throw error;
    }
  }

  approveAction(actionId){
    return this.request(`/api/onboarding/actions/${requiredId(actionId,'actionId')}/approve`,{method:'POST',body:{}});
  }

  denyAction(actionId){
    return this.request(`/api/onboarding/actions/${requiredId(actionId,'actionId')}/deny`,{method:'POST',body:{}});
  }

  executeAction(actionId,{agent,sink}={}){
    if(!String(agent??'').trim()||!String(sink??'').trim()) throw new HushClientError('agent and sink are required');
    return this.request(`/api/onboarding/actions/${requiredId(actionId,'actionId')}/execute`,{method:'POST',body:{agent:String(agent),sink:String(sink)}});
  }
}

export function isLoopbackHushUrl(value){
  try{ return LOOPBACK_HOSTS.has(new URL(String(value)).hostname); }
  catch{ return false; }
}

export const HUSH_DEFAULT_BASE_URL=DEFAULT_BASE_URL;
