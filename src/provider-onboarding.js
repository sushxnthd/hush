import crypto from 'node:crypto';
import { syncConnectorToKernel } from './connector-clients.js';
import { ActionBroker } from './action-broker.js';
import { GOOGLE_ACTION_SCOPES, registerGoogleActionAdapter } from './google-actions.js';

const GOOGLE_CONNECTOR_SCOPES=Object.freeze({
  gmail:'https://www.googleapis.com/auth/gmail.readonly',
  calendar:'https://www.googleapis.com/auth/calendar.readonly',
  drive:'https://www.googleapis.com/auth/drive.metadata.readonly',
  contacts:'https://www.googleapis.com/auth/contacts.readonly'
});
const GOOGLE_AUTH='https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN='https://oauth2.googleapis.com/token';
const GOOGLE_REVOKE='https://oauth2.googleapis.com/revoke';
const GITHUB_DEVICE='https://github.com/login/device/code';
const GITHUB_TOKEN='https://github.com/login/oauth/access_token';
const SESSION_TTL_MS=10*60*1000;

const b64url=value=>Buffer.from(value).toString('base64url');
const sha256url=value=>crypto.createHash('sha256').update(value).digest('base64url');
const randomToken=(bytes=32)=>b64url(crypto.randomBytes(bytes));

function assertFetch(fetchImpl){ if(typeof fetchImpl!=='function') throw new Error('A fetch implementation is required'); }
function assertVault(vault){ if(!vault||typeof vault.list!=='function'||typeof vault.put!=='function'||typeof vault.resolve!=='function'||typeof vault.remove!=='function') throw new Error('An encrypted Hush Vault is required'); }
function jsonHeaders(){ return {'content-type':'application/x-www-form-urlencoded','accept':'application/json'}; }
function form(values){ const out=new URLSearchParams(); for(const [key,value] of Object.entries(values)) if(value!==undefined&&value!==null&&value!=='') out.set(key,String(value)); return out; }
async function providerJson(fetchImpl,url,{method='POST',values,headers={}}={}){
  const response=await fetchImpl(url,{method,headers:{...jsonHeaders(),...headers},body:values?form(values):undefined,redirect:'error'});
  let payload={};
  try{ payload=await response.json(); }catch{}
  if(!response.ok) throw new Error(payload.error_description||payload.error||`Provider request failed (${response.status})`);
  return payload;
}
function publicTokenMetadata(bundle){
  return {
    connected:true,
    provider:bundle.provider,
    connectedAt:bundle.connectedAt,
    expiresAt:bundle.expiresAt??null,
    refreshExpiresAt:bundle.refreshExpiresAt??null,
    connectors:bundle.connectors??[],
    actions:bundle.actions??[],
    scopes:bundle.scopes??[],
    identity:bundle.identity??null,
    needsReauth:Boolean(bundle.needsReauth)
  };
}
function unique(values=[]){return [...new Set((values??[]).map(x=>String(x).toLowerCase()).filter(Boolean))];}

export function createPkcePair(){
  const verifier=randomToken(48);
  return {verifier,challenge:sha256url(verifier),method:'S256'};
}

export class ProviderOnboarding {
  constructor({vault,kernel=null,fetchImpl=globalThis.fetch,env=process.env,port=8787,now=()=>Date.now()}={}){
    assertVault(vault); assertFetch(fetchImpl);
    this.vault=vault;
    this.kernel=kernel;
    this.fetchImpl=fetchImpl;
    this.env=env;
    this.port=Number(port);
    this.now=now;
    this.sessions=new Map();
    this.actionBroker=new ActionBroker({now});
    registerGoogleActionAdapter({broker:this.actionBroker,getAccessToken:()=>this.accessToken('google'),fetchImpl:this.fetchImpl});
  }

  _config(provider){
    if(provider==='google') return {clientId:String(this.env.HUSH_GOOGLE_CLIENT_ID||'').trim()};
    if(provider==='github') return {clientId:String(this.env.HUSH_GITHUB_CLIENT_ID||'').trim()};
    throw new Error(`Unsupported onboarding provider: ${provider}`);
  }
  configured(){
    return {google:Boolean(this._config('google').clientId),github:Boolean(this._config('github').clientId)};
  }
  _vaultItem(provider){ return this.vault.list().find(item=>item.type==='oauth_token'&&item.tags?.includes(`provider:${provider}`))??null; }
  _load(provider){
    const item=this._vaultItem(provider); if(!item) return null;
    try{ return JSON.parse(this.vault.resolve(item.id)); }catch{ return null; }
  }
  _save(provider,bundle){
    const old=this._vaultItem(provider); if(old) this.vault.remove(old.id);
    this.vault.put({label:`OAuth ${provider}`,type:'oauth_token',tags:['oauth',`provider:${provider}`],value:JSON.stringify(bundle)});
    return publicTokenMetadata(bundle);
  }
  _delete(provider){ const item=this._vaultItem(provider); return item?this.vault.remove(item.id):false; }
  _purgeSessions(){ const now=this.now(); for(const [id,s] of this.sessions) if(now>=s.expiresAt) this.sessions.delete(id); }

  status(){
    this._purgeSessions();
    const result={configured:this.configured(),providers:{},actions:{supported:this.actionBroker.listAdapters()}};
    for(const provider of ['google','github']){
      const bundle=this._load(provider);
      result.providers[provider]=bundle?publicTokenMetadata({...bundle,needsReauth:Boolean(bundle.expiresAt&&this.now()>=bundle.expiresAt&&!bundle.refresh_token)}):{connected:false,provider};
    }
    return result;
  }

  startGoogle({connectors=['gmail','calendar','drive','contacts'],actions=[]}={}){
    const {clientId}=this._config('google'); if(!clientId) throw new Error('Google onboarding is not configured');
    const selected=unique(connectors);
    const selectedActions=unique(actions);
    if(selected.some(x=>!GOOGLE_CONNECTOR_SCOPES[x])) throw new Error('Unsupported Google connector selection');
    if(selectedActions.some(x=>!GOOGLE_ACTION_SCOPES[x])) throw new Error('Unsupported Google action selection');
    if(!selected.length&&!selectedActions.length) throw new Error('At least one Google connector or action is required');
    const id=crypto.randomUUID(),state=randomToken(),pkce=createPkcePair();
    const redirectUri=`http://127.0.0.1:${this.port}/api/onboarding/callback/google`;
    const scopes=['openid','email',...selected.map(x=>GOOGLE_CONNECTOR_SCOPES[x]),...selectedActions.map(x=>GOOGLE_ACTION_SCOPES[x])];
    const uniqueScopes=[...new Set(scopes)];
    this.sessions.set(id,{id,provider:'google',state,verifier:pkce.verifier,redirectUri,connectors:selected,actions:selectedActions,scopes:uniqueScopes,expiresAt:this.now()+SESSION_TTL_MS});
    const url=new URL(GOOGLE_AUTH);
    for(const [key,value] of Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:uniqueScopes.join(' '),state,code_challenge:pkce.challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent',include_granted_scopes:'true'})) url.searchParams.set(key,value);
    return {sessionId:id,provider:'google',authorizationUrl:url.toString(),expiresAt:this.now()+SESSION_TTL_MS,connectors:selected,actions:selectedActions,pkce:'S256'};
  }

  async completeGoogle({state,code,error}={}){
    this._purgeSessions();
    if(error) throw new Error(`Google authorization failed: ${error}`);
    const session=[...this.sessions.values()].find(x=>x.provider==='google'&&x.state===state);
    if(!session) throw new Error('OAuth state mismatch or expired authorization');
    this.sessions.delete(session.id);
    if(!code) throw new Error('Google authorization code is missing');
    const {clientId}=this._config('google');
    const token=await providerJson(this.fetchImpl,GOOGLE_TOKEN,{values:{client_id:clientId,code,code_verifier:session.verifier,redirect_uri:session.redirectUri,grant_type:'authorization_code'}});
    if(!token.access_token) throw new Error('Google token exchange returned no access token');
    const connectedAt=this.now();
    const grantedScopes=String(token.scope||session.scopes.join(' ')).split(/\s+/).filter(Boolean);
    const actions=session.actions.filter(action=>grantedScopes.includes(GOOGLE_ACTION_SCOPES[action]));
    const bundle={provider:'google',access_token:token.access_token,refresh_token:token.refresh_token??null,token_type:token.token_type??'Bearer',connectedAt,expiresAt:token.expires_in?connectedAt+Number(token.expires_in)*1000:null,refreshExpiresAt:null,connectors:session.connectors,actions,scopes:grantedScopes};
    return this._save('google',bundle);
  }

  async startGithub(){
    const {clientId}=this._config('github'); if(!clientId) throw new Error('GitHub onboarding is not configured');
    const payload=await providerJson(this.fetchImpl,GITHUB_DEVICE,{values:{client_id:clientId}});
    if(!payload.device_code||!payload.user_code||!payload.verification_uri) throw new Error('GitHub device authorization returned an invalid response');
    const id=crypto.randomUUID(),intervalMs=Math.max(5000,Number(payload.interval||5)*1000),expiresAt=this.now()+Number(payload.expires_in||900)*1000;
    this.sessions.set(id,{id,provider:'github',deviceCode:String(payload.device_code),intervalMs,lastPollAt:0,expiresAt});
    return {sessionId:id,provider:'github',verificationUri:String(payload.verification_uri),userCode:String(payload.user_code),intervalMs,expiresAt};
  }

  async pollGithub(sessionId){
    this._purgeSessions();
    const session=this.sessions.get(String(sessionId));
    if(!session||session.provider!=='github') throw new Error('GitHub authorization session is missing or expired');
    const now=this.now();
    if(session.lastPollAt&&now-session.lastPollAt<session.intervalMs) return {status:'pending',retryAfterMs:session.intervalMs-(now-session.lastPollAt)};
    session.lastPollAt=now;
    const {clientId}=this._config('github');
    const payload=await providerJson(this.fetchImpl,GITHUB_TOKEN,{values:{client_id:clientId,device_code:session.deviceCode,grant_type:'urn:ietf:params:oauth:grant-type:device_code'}});
    if(payload.error){
      if(payload.error==='authorization_pending') return {status:'pending',retryAfterMs:session.intervalMs};
      if(payload.error==='slow_down'){ session.intervalMs+=5000; return {status:'pending',retryAfterMs:session.intervalMs}; }
      throw new Error(payload.error_description||payload.error);
    }
    if(!payload.access_token) return {status:'pending',retryAfterMs:session.intervalMs};
    this.sessions.delete(session.id);
    const connectedAt=this.now();
    const bundle={provider:'github',access_token:payload.access_token,refresh_token:payload.refresh_token??null,token_type:payload.token_type??'bearer',connectedAt,expiresAt:payload.expires_in?connectedAt+Number(payload.expires_in)*1000:null,refreshExpiresAt:payload.refresh_token_expires_in?connectedAt+Number(payload.refresh_token_expires_in)*1000:null,connectors:['github'],actions:[],scopes:[]};
    return {status:'connected',connection:this._save('github',bundle)};
  }

  async _refreshGoogle(bundle){
    if(!bundle.refresh_token) throw new Error('Google connection requires re-authentication');
    const {clientId}=this._config('google');
    const payload=await providerJson(this.fetchImpl,GOOGLE_TOKEN,{values:{client_id:clientId,refresh_token:bundle.refresh_token,grant_type:'refresh_token'}});
    if(!payload.access_token) throw new Error('Google refresh returned no access token');
    const now=this.now();
    const next={...bundle,access_token:payload.access_token,refresh_token:payload.refresh_token??bundle.refresh_token,token_type:payload.token_type??bundle.token_type,expiresAt:payload.expires_in?now+Number(payload.expires_in)*1000:null,scopes:payload.scope?String(payload.scope).split(/\s+/).filter(Boolean):bundle.scopes,needsReauth:false};
    next.actions=Object.entries(GOOGLE_ACTION_SCOPES).filter(([,scope])=>next.scopes.includes(scope)).map(([action])=>action);
    this._save('google',next);
    return next;
  }

  async accessToken(provider){
    let bundle=this._load(provider); if(!bundle) throw new Error(`${provider} is not connected`);
    if(bundle.expiresAt&&this.now()>=bundle.expiresAt-60_000){
      if(provider==='google') bundle=await this._refreshGoogle(bundle);
      else throw new Error('GitHub connection requires re-authentication');
    }
    return bundle.access_token;
  }

  async sync(provider,{connectors=null,limit=50}={}){
    if(!this.kernel) throw new Error('Private context is locked; unlock Hush before syncing connectors');
    const token=await this.accessToken(provider);
    const bundle=this._load(provider);
    const selected=provider==='google'?(connectors??bundle.connectors??[]):['github'];
    const results=[];
    for(const connector of selected){
      if(provider==='google'&&!GOOGLE_CONNECTOR_SCOPES[connector]) throw new Error(`Unsupported Google connector: ${connector}`);
      results.push({connector,...await syncConnectorToKernel({kernel:this.kernel,provider:connector,accessToken:token,limit,fetchImpl:this.fetchImpl})});
    }
    return {provider,syncedAt:this.now(),connectors:results};
  }

  requestAction({provider='google',action,agent='unknown-agent',sink=null,purpose='unspecified',category=null,resource='me',arguments:args={}}={}){
    const normalizedProvider=String(provider).toLowerCase();
    const actionName=String(action??'').toLowerCase();
    if(normalizedProvider!=='google'||!GOOGLE_ACTION_SCOPES[actionName]) throw new Error('Unsupported provider action');
    const bundle=this._load('google');
    if(!bundle) return {decision:'reauthorize',reason:'Google is not connected.',authorization:this.startGoogle({connectors:[],actions:[actionName]})};
    const requiredScope=GOOGLE_ACTION_SCOPES[actionName];
    if(!bundle.scopes?.includes(requiredScope)){
      const currentActions=unique([...(bundle.actions??[]),actionName]);
      return {decision:'reauthorize',reason:'This action needs an additional least-privilege Google scope.',requiredScope,authorization:this.startGoogle({connectors:bundle.connectors??[],actions:currentActions})};
    }
    return this.actionBroker.request({adapter:'google',action:actionName,agent,sink:sink??`google:${actionName}`,purpose,category:category??(actionName==='send_email'?'communication':'calendar'),resource,arguments:args,credentialRefs:[]});
  }
  actionQueue(){ return this.actionBroker.queue(); }
  approveAction(actionId){ return this.actionBroker.approve(actionId); }
  denyAction(actionId){ return this.actionBroker.deny(actionId); }
  executeAction({actionId,agent='unknown-agent',sink='unknown-sink'}={}){ return this.actionBroker.execute({actionId,agent,sink}); }
  actionReceipts(){ return this.actionBroker.receiptLog(); }

  async disconnect(provider,{remote=true}={}){
    const bundle=this._load(provider); if(!bundle) return {provider,disconnected:true,remoteRevoked:false};
    let remoteRevoked=false;
    if(remote&&provider==='google'){
      const value=bundle.refresh_token||bundle.access_token;
      if(value){
        try{ const response=await this.fetchImpl(`${GOOGLE_REVOKE}?token=${encodeURIComponent(value)}`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},redirect:'error'}); remoteRevoked=Boolean(response?.ok); }catch{}
      }
    }
    this._delete(provider);
    for(const [id,s] of this.sessions) if(s.provider===provider) this.sessions.delete(id);
    return {provider,disconnected:true,remoteRevoked,localAuthorityRemoved:true};
  }
}
