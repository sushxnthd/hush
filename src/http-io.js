import {securityHeaders} from './local-http-security.js';
export {readResponseText} from './response-io.js';

const failure=(message,status,code)=>Object.assign(new Error(message),{status,code});

// Event-based reading keeps the response socket alive long enough to send 4xx.
// Throwing from an IncomingMessage async iterator destroys it before that reply.
export function readRequestBody(req,{maxBytes=1_000_000,timeoutMs=15_000}={}){
  return new Promise((resolve,reject)=>{
    let size=0;
    const chunks=[];
    let timer;
    const cleanup=()=>{clearTimeout(timer);for(const [event,fn] of listeners)req.removeListener(event,fn);};
    const fail=error=>{cleanup();req.resume();reject(error);};
    const data=chunk=>{
      size+=chunk.length;
      if(size>maxBytes)return fail(failure('Request body too large',413,'BODY_TOO_LARGE'));
      chunks.push(Buffer.from(chunk));
    };
    const end=()=>{cleanup();resolve(Buffer.concat(chunks,size));};
    const aborted=()=>fail(failure('Request was interrupted',400,'REQUEST_ABORTED'));
    const error=()=>fail(failure('Request could not be read',400,'REQUEST_READ_FAILED'));
    const listeners=[['data',data],['end',end],['aborted',aborted],['error',error]];
    const declared=req.headers?.['content-length'];
    if(declared!==undefined&&(!/^\d+$/.test(String(declared))||Number(declared)>maxBytes))return fail(failure('Request body too large',413,'BODY_TOO_LARGE'));
    for(const [event,fn] of listeners)req.on(event,fn);
    timer=setTimeout(()=>fail(failure('Request body timed out',408,'BODY_TIMEOUT')),timeoutMs);
  });
}

export async function readJsonObject(req,options){
  const bytes=await readRequestBody(req,options);
  let value;
  try{value=JSON.parse(bytes.toString('utf8')||'{}');}
  catch{throw failure('Invalid JSON',400,'INVALID_JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw failure('JSON body must be an object',400,'INVALID_JSON_OBJECT');
  return value;
}

export function sendJson(res,status,payload){
  const value=JSON.stringify(payload);
  res.writeHead(status,securityHeaders({'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(value)}));
  res.end(value);
}
