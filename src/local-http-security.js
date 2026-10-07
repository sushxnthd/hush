const LOOPBACK_HOSTS=new Set(['127.0.0.1','localhost','[::1]','::1']);

function hostOnly(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  if(raw.startsWith('[')) return raw.slice(0,raw.indexOf(']')+1).toLowerCase();
  return raw.split(':')[0].toLowerCase();
}
function allowedOrigin(value){
  if(!value) return true;
  const origin=String(value).trim();
  if(origin.startsWith('chrome-extension://')||origin.startsWith('moz-extension://')) return true;
  try{
    const url=new URL(origin);
    return ['http:','https:'].includes(url.protocol)&&LOOPBACK_HOSTS.has(url.hostname.toLowerCase());
  }catch{return false;}
}

/**
 * The Hush HTTP API is a same-device control surface, not a network service.
 * Reject DNS-rebinding Host headers and ordinary web origins before parsing a
 * request body. Native local clients normally omit Origin and remain allowed.
 */
export function assertLocalHttpRequest(req){
  const host=hostOnly(req?.headers?.host);
  if(!LOOPBACK_HOSTS.has(host)) throw Object.assign(new Error('Hush only accepts loopback Host headers.'),{status:403,code:'NON_LOOPBACK_HOST'});
  const origin=req?.headers?.origin;
  if(!allowedOrigin(origin)) throw Object.assign(new Error('This web origin is not allowed to control Hush.'),{status:403,code:'UNTRUSTED_ORIGIN'});
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
