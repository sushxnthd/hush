import {readResponseText} from './response-io.js';

const MAX_MESSAGE=2_000_000;
const replyError=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
const safeId=value=>typeof value==='string'||(typeof value==='number'&&Number.isFinite(value))?value:null;

// A native-tool bridge, not a second authority API. The only outbound route is
// /mcp, authenticated with a domain-separated transport credential.
export async function runStdioTransport({input,output,endpoint,token,agent='mcp-client',fetchImpl=globalThis.fetch,signal,timeoutMs=30_000,maxQueued=8}={}){
  const url=new URL(endpoint);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/mcp'||url.search||url.hash)throw new Error('MCP stdio requires the local Hush /mcp endpoint');
  let queue=Promise.resolve();
  let pending=0;
  let stopped=false;
  let outputError=null;
  let buffer=Buffer.alloc(0);
  const onOutputError=error=>{outputError=error;input.destroy?.(error);};
  output.on('error',onOutputError);
  const write=async payload=>{
    const line=JSON.stringify(payload)+'\n';
    await new Promise((resolve,reject)=>output.write(line,error=>error?reject(error):resolve()));
  };
  const dispatch=async line=>{
    let rpc;
    try{rpc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(line));}
    catch{await write(replyError(null,-32700,'Invalid JSON.'));return;}
    const id=safeId(rpc?.id);
    if(!rpc||Array.isArray(rpc)||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string'||(Object.hasOwn(rpc,'id')&&id===null)){
      await write(replyError(null,-32600,'Invalid JSON-RPC request.'));return;
    }
    const notification=!Object.hasOwn(rpc,'id');
    try{
      const response=await fetchImpl(url,{method:'POST',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs),headers:{accept:'application/json, text/event-stream','content-type':'application/json','mcp-protocol-version':'2025-11-25',authorization:`Bearer ${token}`,'x-hush-agent':String(agent).slice(0,80),'x-hush-purpose':'MCP private computation'},body:JSON.stringify(rpc)});
      if(notification){await response.body?.cancel?.();return;}
      if(!response.ok)throw new Error('transport rejected');
      if(!(response.headers.get('content-type')||'').includes('application/json'))throw new Error('unsupported stream');
      const result=JSON.parse(await readResponseText(response,MAX_MESSAGE));
      if(result.jsonrpc!=='2.0'||result.id!==rpc.id||(!Object.hasOwn(result,'result')&&!Object.hasOwn(result,'error')))throw new Error('invalid response');
      await write(result);
    }catch{
      // No raw provider errors, headers or tokens reach protocol output.
      if(!notification)await write(replyError(id,-32603,'Cannot complete the local Hush request. Start Hush, check its keystore and authentication, and use native JSON MCP tools.'));
    }
  };
  const enqueue=line=>{
    if(!line.length)return;
    if(pending>=maxQueued)throw new Error('MCP input queue exceeded the safety limit');
    pending++;
    queue=queue.then(()=>{if(!outputError)return dispatch(line);}).catch(error=>{outputError=error;}).finally(()=>pending--);
  };
  try{
    for await(const chunk of input){
      if(signal?.aborted){stopped=true;break;}
      const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
      let offset=0;
      while(offset<bytes.length){
        const newline=bytes.indexOf(10,offset);
        const end=newline===-1?bytes.length:newline;
        const part=bytes.subarray(offset,end);
        if(buffer.length+part.length>MAX_MESSAGE)throw new Error('MCP input exceeded the safety limit');
        buffer=Buffer.concat([buffer,part]);
        if(newline===-1)break;
        enqueue(buffer);
        buffer=Buffer.alloc(0);
        offset=newline+1;
      }
    }
    if(buffer.length&&!stopped)throw new Error('MCP input ended without a newline');
  }finally{await queue;output.removeListener('error',onOutputError);}
  if(outputError)throw outputError;
}
