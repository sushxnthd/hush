import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import {runStdioTransport} from '../src/mcp-stdio-transport.js';
const endpoint='http://127.0.0.1:8787/mcp';
async function run(lines,fetchImpl,options={}){
  let text='';
  const output=new Writable({write(chunk,_,done){text+=chunk;done();}});
  await runStdioTransport({input:Readable.from(lines.map(s=>Buffer.from(s))),output,endpoint,token:'MCP-TRANSPORT-SECRET',fetchImpl,...options});
  return text.trim()?text.trim().split('\n').map(s=>JSON.parse(s)):[];
}
const rpc=(id,method='ping')=>JSON.stringify({jsonrpc:'2.0',id,method})+'\n';
test('stdio forwards only to authenticated loopback MCP and stdout is pure JSONRPC',async()=>{
  const seen=[];
  const out=await run([rpc(1),rpc(2)],async(url,options)=>{
    seen.push({url,options});const input=JSON.parse(options.body);
    return Response.json({jsonrpc:'2.0',id:input.id,result:{ok:true}});
  });
  assert.deepEqual(out.map(x=>x.id),[1,2]);
  assert.equal(seen[0].url.href,endpoint);
  assert.equal(seen[0].options.headers.authorization,'Bearer MCP-TRANSPORT-SECRET');
  assert.equal(seen[0].options.redirect,'error');
  assert.equal(JSON.stringify(out).includes('SECRET'),false);
});
test('stdio handles fragmented multibyte UTF8 and newline messages',async()=>{
  const bytes=Buffer.from(JSON.stringify({jsonrpc:'2.0',id:'हश',method:'ping'})+'\n');
  const out=await run([...bytes].map(x=>Buffer.from([x])),async(_url,o)=>Response.json({jsonrpc:'2.0',id:JSON.parse(o.body).id,result:{}}));
  assert.equal(out[0].id,'हश');
});
test('stdio notifications have no response and subsequent request still completes',async()=>{
  const out=await run(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n',rpc(2)],async(_u,o)=>Object.hasOwn(JSON.parse(o.body),'id')?Response.json({jsonrpc:'2.0',id:2,result:{}}):new Response(null,{status:202}));
  assert.equal(out.length,1);assert.equal(out[0].id,2);
});
test('stdio malformed messages fail locally and never reach authority',async()=>{
  let calls=0;
  const out=await run(['bad\n','[]\n','{"jsonrpc":"1.0","id":1,"method":"ping"}\n'],async()=>{calls++;});
  assert.equal(calls,0);assert.deepEqual(out.map(x=>x.error.code),[-32700,-32600,-32600]);
});
test('stdio rejects remote, credential-bearing, non-MCP or HTTPS endpoints',async()=>{
  for(const url of ['https://example.com/mcp','http://127.0.0.1:8787/api/context','http://user:secret@localhost:8787/mcp','https://localhost:8787/mcp'])await assert.rejects(run([],()=>{}, {endpoint:url}),/local Hush/);
});
test('stdio sanitizes upstream failures and mismatched response IDs without retries',async()=>{
  let calls=0;
  const out=await run([rpc(3),rpc(4)],async()=>{
    calls++;
    if(calls===1)throw new Error('PRIVATE-PAYLOAD-SECRET');
    return Response.json({jsonrpc:'2.0',id:999,result:{private:'SECRET'}});
  });
  assert.equal(calls,2);assert.equal(out.length,2);
  assert.equal(out[0].error.code,-32603);
  assert.equal(JSON.stringify(out).includes('SECRET'),false);
});
test('stdio oversized and unterminated messages fail closed',async()=>{
  await assert.rejects(run(['x'.repeat(2_000_001)],()=>{}),/safety limit/);
  await assert.rejects(run(['{"jsonrpc":"2.0"}'],()=>{}),/newline/);
});
test('stdio queue limits bound concurrent input',async()=>{
  await assert.rejects(run([rpc(1)+rpc(2)],async()=>Response.json({jsonrpc:'2.0',id:1,result:{}}),{maxQueued:1}),/queue/);
});
