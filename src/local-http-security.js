import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOrCreatePlatformRootKey } from './platform-key-store.js';
import { resolveHushDataDir } from './runtime-paths.js';
import { LocalClientAuth } from './local-client-auth.js';

const LOOPBACK_HOSTS=new Set(['127.0.0.1','localhost','[::1]','::1']);
let cachedRuntimeAuth=null;
let cachedRuntimeAuthKey='';

function hostOnly(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  if(raw.startsWith('[')) return raw.slice(0,raw.indexOf(']')+1).toLowerCase();
  return raw.split(':')[0].toLowerCase();
}
export function parseTrustedExtensionOrigins(value=''){
  const origins=[];
  for(const raw of Array.isArray(value)?value:String(value||'').split(',')){
    const origin=String(raw??'').trim().toLowerCase();
    if(!origin) continue;
    if(!/^chrome-extension:\/\/[a-p]{32}$/i.test(origin)&&!/^moz-extension:\/\/[0-9a-f-]{20,}$/i.test(origin)) throw new Error(`Invalid trusted extension origin: ${origin}`);
    origins.push(origin);
  }
  return [...new Set(origins)];
}
function allowedOrigin(value,{allowedExtensionOrigins=[]}={}){
  if(!value) return true;
  const origin=String(value).trim().toLowerCase();
  if(origin.startsWith('chrome-extension://')||origin.startsWith('moz-extension://')) return new Set(allowedExtensionOrigins.map(x=>String(x).toLowerCase())).has(origin);
  try{
    const url=new URL(origin);
    return ['http:','https:'].includes(url.protocol)&&LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  }catch{return false;}
}
function runtimeAuth({allowedExtensionOrigins=[]}={}){
  const required=process.env.NODE_ENV==='production'||process.env.HUSH_REQUIRE_LOCAL_AUTH==='1';
  if(!required) return null;
  const originKey=allowedExtensionOrigins.slice().sort().join(',');
  const cacheKey=`${process.env.NODE_ENV||''}|${process.env.HUSH_DATA_DIR||''}|${originKey}`;
  if(cachedRuntimeAuth&&cachedRuntimeAuthKey===cacheKey) return cachedRuntimeAuth;
  const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const {dataDir}=resolveHushDataDir({appRoot});
  const rootKeyInfo=getOrCreatePlatformRootKey(dataDir);
  cachedRuntimeAuth=new LocalClientAuth({rootKey:rootKeyInfo.key,required:true,allowedExtensionOrigins});
  cachedRuntimeAuthKey=cacheKey;
  return cachedRuntimeAuth;
}
function pathname(req){
  try{return new URL(String(req?.url||'/'),'http://127.0.0.1').pathname;}
  catch{return '/';}
}
function authorizeRoute(req,auth){
  if(!auth) return;
  const p=pathname(req);
  if(p==='/api/onboarding/callback/google') return;
  if(p==='/mcp'){ auth.authorizeMcp(req); return; }
  if(p.startsWith('/api/')) auth.authorizeApi(req);
}

/**
 * The Hush HTTP API is a same-device control surface, not a network service.
 * Reject DNS-rebinding Host headers, non-approved browser origins, and anonymous
 * local API/MCP callers before parsing a request body. The Google loopback OAuth
 * callback is state+PKCE bound and is the only unauthenticated API exception.
 */
export function assertLocalHttpRequest(req,{allowedExtensionOrigins=null,auth=null}={}){
  const trusted=allowedExtensionOrigins??parseTrustedExtensionOrigins(process.env.HUSH_ALLOWED_EXTENSION_ORIGINS||'');
  const host=hostOnly(req?.headers?.host);
  if(!LOOPBACK_HOSTS.has(host)) throw Object.assign(new Error('Hush only accepts loopback Host headers.'),{status:403,code:'NON_LOOPBACK_HOST'});
  const origin=req?.headers?.origin;
  if(!allowedOrigin(origin,{allowedExtensionOrigins:trusted})) throw Object.assign(new Error('This web origin is not allowed to control Hush.'),{status:403,code:'UNTRUSTED_ORIGIN'});
  authorizeRoute(req,auth??runtimeAuth({allowedExtensionOrigins:trusted}));
  return true;
}

export function securityHeaders(extra={}){
  return {
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    'x-frame-options':'DENY',
    'referrer-policy':'no-referrer',
    'permissions-policy':'camera=(), microphone=(), geolocation=(), payment=()',
    ...extra
  };
}
