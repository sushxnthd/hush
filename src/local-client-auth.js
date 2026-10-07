import crypto from 'node:crypto';

const CONTROL_INFO='hush-local-control-api-v1';
const MCP_INFO='hush-local-mcp-transport-v1';
const DEFAULT_SESSION_TTL=8*60*60*1000;
const DEFAULT_LAUNCH_TTL=60*1000;

function validRootKey(value){ return Buffer.isBuffer(value)&&value.length===32; }
function tokenFrom(rootKey,info){
  if(!validRootKey(rootKey)) throw new Error('A valid Hush root key is required for local client authentication');
  return Buffer.from(crypto.hkdfSync('sha256',rootKey,Buffer.from('hush-local-client-auth-v1'),Buffer.from(info),32)).toString('base64url');
}
function secureEqual(a,b){
  const x=Buffer.from(String(a??'')),y=Buffer.from(String(b??''));
  return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);
}
function bearer(header,scheme){
  const raw=String(header??'').trim();
  const prefix=`${scheme} `;
  return raw.toLowerCase().startsWith(prefix.toLowerCase())?raw.slice(prefix.length).trim():null;
}
function cookies(value){
  const out={};
  for(const part of String(value??'').split(';')){
    const at=part.indexOf('=');
    if(at<=0) continue;
    out[part.slice(0,at).trim()]=decodeURIComponent(part.slice(at+1).trim());
  }
  return out;
}
function cleanOrigins(values=[]){
  const out=new Set();
  for(const value of values??[]){
    const origin=String(value??'').trim();
    if(/^chrome-extension:\/\/[a-p]{32}$/i.test(origin)||/^moz-extension:\/\/[0-9a-f-]{20,}$/i.test(origin)) out.add(origin.toLowerCase());
    else if(origin) throw new Error(`Invalid trusted extension origin: ${origin}`);
  }
  return out;
}

export function deriveLocalControlToken(rootKey){ return tokenFrom(rootKey,CONTROL_INFO); }
export function deriveMcpTransportToken(rootKey){ return tokenFrom(rootKey,MCP_INFO); }

export class LocalClientAuth {
  constructor({rootKey,required=true,allowedExtensionOrigins=[],now=()=>Date.now(),sessionTtlMs=DEFAULT_SESSION_TTL,launchTtlMs=DEFAULT_LAUNCH_TTL}={}){
    this.required=Boolean(required);
    this.controlToken=deriveLocalControlToken(rootKey);
    this.mcpToken=deriveMcpTransportToken(rootKey);
    this.allowedExtensionOrigins=cleanOrigins(allowedExtensionOrigins);
    this.now=now;
    this.sessionTtlMs=Math.max(60_000,Number(sessionTtlMs)||DEFAULT_SESSION_TTL);
    this.launchTtlMs=Math.max(10_000,Number(launchTtlMs)||DEFAULT_LAUNCH_TTL);
    this.sessions=new Map();
    this.launches=new Map();
  }

  _purge(){
    const now=this.now();
    for(const [id,item] of this.sessions) if(now>=item.expiresAt) this.sessions.delete(id);
    for(const [id,item] of this.launches) if(now>=item.expiresAt) this.launches.delete(id);
  }
  isTrustedExtension(origin){ return this.allowedExtensionOrigins.has(String(origin??'').toLowerCase()); }
  authorizeApi(req){
    if(!this.required) return {authorized:true,method:'development-bypass'};
    this._purge();
    const origin=String(req?.headers?.origin??'').toLowerCase();
    if(origin&&this.isTrustedExtension(origin)) return {authorized:true,method:'trusted-extension'};
    const supplied=bearer(req?.headers?.authorization,'Hush');
    if(supplied&&secureEqual(supplied,this.controlToken)) return {authorized:true,method:'control-token'};
    const sessionId=cookies(req?.headers?.cookie).hush_session;
    const session=sessionId?this.sessions.get(sessionId):null;
    if(session&&this.now()<session.expiresAt) return {authorized:true,method:'dashboard-session',sessionId};
    throw Object.assign(new Error('Local Hush client authentication is required.'),{status:401,code:'LOCAL_AUTH_REQUIRED'});
  }
  authorizeMcp(req){
    if(!this.required) return {authorized:true,method:'development-bypass'};
    const supplied=bearer(req?.headers?.authorization,'Bearer')??bearer(req?.headers?.authorization,'Hush-MCP');
    if(supplied&&secureEqual(supplied,this.mcpToken)) return {authorized:true,method:'mcp-transport-token'};
    throw Object.assign(new Error('Hush MCP transport authentication is required.'),{status:401,code:'MCP_AUTH_REQUIRED'});
  }
  issueDashboardLaunch(){
    this._purge();
    const token=crypto.randomBytes(32).toString('base64url');
    const expiresAt=this.now()+this.launchTtlMs;
    this.launches.set(token,{expiresAt});
    return {launchToken:token,path:`/dashboard/bootstrap/${encodeURIComponent(token)}`,expiresAt};
  }
  consumeDashboardLaunch(token){
    this._purge();
    const value=String(token??'');
    const launch=this.launches.get(value);
    if(!launch) throw Object.assign(new Error('Dashboard launch token is invalid or expired.'),{status:401,code:'INVALID_DASHBOARD_LAUNCH'});
    this.launches.delete(value);
    const sessionId=crypto.randomBytes(32).toString('base64url');
    const expiresAt=this.now()+this.sessionTtlMs;
    this.sessions.set(sessionId,{expiresAt});
    return {
      sessionId,expiresAt,
      cookie:`hush_session=${encodeURIComponent(sessionId)}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(this.sessionTtlMs/1000)}`
    };
  }
  revokeDashboardSession(sessionId){ return this.sessions.delete(String(sessionId??'')); }
}
