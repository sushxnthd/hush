const LOOPBACK_HOSTS=new Set(['127.0.0.1','localhost','[::1]','::1']);

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

/**
 * The Hush HTTP API is a same-device control surface, not a network service.
 * Reject DNS-rebinding Host headers and non-approved browser origins before
 * parsing a request body. Browser extensions must match an exact configured
 * origin; wildcard extension trust is intentionally unsupported.
 */
export function assertLocalHttpRequest(req,{allowedExtensionOrigins=[]}={}){
  const host=hostOnly(req?.headers?.host);
  if(!LOOPBACK_HOSTS.has(host)) throw Object.assign(new Error('Hush only accepts loopback Host headers.'),{status:403,code:'NON_LOOPBACK_HOST'});
  const origin=req?.headers?.origin;
  if(!allowedOrigin(origin,{allowedExtensionOrigins})) throw Object.assign(new Error('This web origin is not allowed to control Hush.'),{status:403,code:'UNTRUSTED_ORIGIN'});
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
