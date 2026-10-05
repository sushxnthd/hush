const DEFAULT_BASE_URL='http://127.0.0.1:8787';
const LOOPBACK_HOSTS=new Set(['127.0.0.1','localhost','[::1]','::1']);
const MAX_TEXT_BYTES=256*1024;

function cleanBaseUrl(value,{allowRemote=false}={}){
  const url=new URL(String(value||DEFAULT_BASE_URL));
  if(!['http:','https:'].includes(url.protocol)) throw new Error('Hush client endpoint must use http or https');
  if(!allowRemote&&!LOOPBACK_HOSTS.has(url.hostname)) throw new Error('Remote Hush endpoints are disabled by default; use an authenticated transport before enabling them');
  url.pathname='/';
  url.search='';
  url.hash='';
  return url;
}
function pathUrl(base,path){ return new URL(String(path).replace(/^\//,''),base); }
function clone(value){ return structuredClone(value); }

export class HushClientError extends Error {
  constructor(message,{status=null,payload=null}={}){
    super(message);
    this.name='HushClientError';
    this.status=status;
    this.payload=payload;
  }
}

/**
 * Small dependency-free client shared by browser-extension, desktop and future
 * mobile shells. It intentionally defaults to loopback only: exposing the alpha
 * local API over a network without a separate authenticated transport is unsafe.
 */
export class HushClient {
  constructor({baseUrl=DEFAULT_BASE_URL,fetchImpl=globalThis.fetch,allowRemote=false,timeoutMs=5000}={}){
    if(typeof fetchImpl!=='function') throw new Error('HushClient requires fetch');
    const timeout=Number(timeoutMs);
    if(!Number.isFinite(timeout)||timeout<100||timeout>120000) throw new Error('timeoutMs must be between 100 and 120000');
    this.baseUrl=cleanBaseUrl(baseUrl,{allowRemote});
    this.fetchImpl=fetchImpl;
    this.timeoutMs=timeout;
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
      const options={method:String(method).toUpperCase(),signal:controller.signal,headers:{accept:'application/json'}};
      if(body!==undefined){
        options.headers['content-type']='application/json';
        options.body=JSON.stringify(body);
      }
      const response=await this.fetchImpl(pathUrl(this.baseUrl,path),options);
      const raw=await response.text();
      if(Buffer.byteLength(raw)>MAX_TEXT_BYTES) throw new HushClientError('Hush response exceeded the client safety limit',{status:response.status});
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

  redact(text){
    const value=String(text??'');
    if(Buffer.byteLength(value)>MAX_TEXT_BYTES) throw new HushClientError('Text is too large to redact in one request');
    return this.request('/api/redact',{method:'POST',body:{text:value}});
  }

  approve(pendingId){
    const id=encodeURIComponent(String(pendingId||''));
    if(!id) throw new HushClientError('pendingId is required');
    return this.request(`/api/pending/${id}/approve`,{method:'POST',body:{}});
  }

  deny(pendingId){
    const id=encodeURIComponent(String(pendingId||''));
    if(!id) throw new HushClientError('pendingId is required');
    return this.request(`/api/pending/${id}/deny`,{method:'POST',body:{}});
  }

  setTrust(agent,level){
    return this.request('/api/privacy/trust',{method:'POST',body:{agent:String(agent),level:String(level)}});
  }
}

export function isLoopbackHushUrl(value){
  try{ return LOOPBACK_HOSTS.has(new URL(String(value)).hostname); }
  catch{ return false; }
}

export const HUSH_DEFAULT_BASE_URL=DEFAULT_BASE_URL;
