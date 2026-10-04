import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

async function listen(server){
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  return server.address().port;
}
async function freePort(){
  const s=http.createServer();
  const p=await listen(s);
  await new Promise(resolve=>s.close(resolve));
  return p;
}
async function json(url,payload,headers={}){
  const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload)});
  return {status:r.status,body:await r.json()};
}
async function waitFor(url,child){
  for(let i=0;i<80;i++){
    if(child.exitCode!=null) throw new Error(`Supakeep exited early with ${child.exitCode}`);
    try{const r=await fetch(url);if(r.ok)return await r.json()}catch{}
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('Supakeep did not start');
}

test('MCP proxy enforces exact one-shot approval before forwarding', {timeout:15000}, async t=>{
  const forwarded=[];
  const upstream=http.createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const rpc=JSON.parse(Buffer.concat(chunks).toString());
    if(rpc.method==='tools/list'){
      res.writeHead(200,{'content-type':'application/json','mcp-session-id':'mock-session'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{tools:[{name:'search',description:'mock search',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:{type:'object'}}]}}));
      return;
    }
    if(rpc.method==='tools/call'){
      forwarded.push(rpc.params);
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{content:[{type:'text',text:'ok'}]}}));
      return;
    }
    res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{}}));
  });
  const upstreamPort=await listen(upstream);
  const port=await freePort();
  const child=spawn(process.execPath,['src/server.js'],{
    cwd:process.cwd(),
    env:{...process.env,PORT:String(port),SUPAKEEP_MCP_UPSTREAM:`http://127.0.0.1:${upstreamPort}/mcp`,SUPAKEEP_MCP_TRUST_TOOL_ANNOTATIONS:'0'},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';child.stderr.on('data',d=>stderr+=d);
  t.after(async()=>{if(child.exitCode==null)child.kill('SIGTERM');await new Promise(resolve=>upstream.close(resolve));});

  const base=`http://127.0.0.1:${port}`;
  await waitFor(`${base}/api/status`,child);
  const h={'x-supakeep-agent':'claude','x-supakeep-purpose':'research'};

  const listed=await json(`${base}/mcp`,{jsonrpc:'2.0',id:1,method:'tools/list',params:{}},h);
  assert.equal(listed.body.result.tools[0].name,'search');
  const status=await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.mcp.observedTools,1);

  const original={jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'search',arguments:{q:'alpha'}}};
  const first=await json(`${base}/mcp`,original,h);
  assert.equal(first.body.error.data.decision,'ask');
  assert.equal(forwarded.length,0);
  const pendingId=first.body.error.data.pendingId;

  const approved=await json(`${base}/api/pending/${pendingId}/approve`,{},{});
  assert.equal(approved.body.approved,true);
  assert.equal(approved.body.oneShot,true);

  const changed=await json(`${base}/mcp`,{...original,id:3,params:{name:'search',arguments:{q:'beta'}}},h);
  assert.equal(changed.body.error.data.decision,'ask');
  assert.equal(forwarded.length,0);

  const exact=await json(`${base}/mcp`,{...original,id:4},h);
  assert.equal(exact.body.result.content[0].text,'ok');
  assert.equal(forwarded.length,1);
  assert.equal(forwarded[0].arguments.q,'alpha');

  const replay=await json(`${base}/mcp`,{...original,id:5},h);
  assert.equal(replay.body.error.data.decision,'ask');
  assert.equal(forwarded.length,1);

  const secret=await json(`${base}/mcp`,{...original,id:6,params:{name:'search',arguments:{q:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}}},h);
  assert.equal(secret.body.error.data.decision,'deny');
  assert.equal(forwarded.length,1,stderr);
});
