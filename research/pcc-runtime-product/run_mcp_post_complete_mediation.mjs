import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
const canonical=value=>JSON.stringify(stable(value),null,2);
function summarizePayload(payload){
  if(typeof payload==='string')return {empty:payload.length===0};
  if(payload?.error)return {error:{code:payload.error.code,message:payload.error.message,decision:payload.error.data?.decision??null,pendingIdPresent:Boolean(payload.error.data?.pendingId)}};
  if(Array.isArray(payload?.result?.tools))return {result:{toolNames:payload.result.tools.map(tool=>tool.name)}};
  if(Array.isArray(payload?.result?.content))return {result:{contentTypes:payload.result.content.map(item=>item.type)}};
  return {resultKeys:Object.keys(payload?.result??{}).sort()};
}
const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>resolve(server.address().port))});
async function freePort(){const s=http.createServer();const p=await listen(s);await new Promise(r=>s.close(r));return p}
async function waitFor(url,child,stderr){for(let i=0;i<240;i++){if(child.exitCode!=null)throw Error(`Hush exited ${child.exitCode}: ${stderr()}`);try{if((await fetch(url)).ok)return}catch{}await new Promise(r=>setTimeout(r,50))}throw Error(`Hush did not start: ${stderr()}`)}

async function run(){
  let hushBase='';
  const arrivals=[];
  const upstream=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const raw=Buffer.concat(chunks).toString();
    const rpc=JSON.parse(raw);
    const status=await (await fetch(`${hushBase}/api/status`)).json();
    const snapshot=await (await fetch(`${hushBase}/api/receipts`)).json();
    arrivals.push({
      method:rpc.method,
      tool:rpc.params?.name??null,
      authorization:req.headers.authorization??null,
      receiptCountAtArrival:status.receipts,
      newestReceipt:snapshot.receipts[0]??null
    });
    if(rpc.method==='tools/list'){
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:{tools:[{name:'search',description:'probe',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]}}));return;
    }
    if(rpc.method==='tools/call'&&rpc.params?.arguments?.q==='error'){
      res.writeHead(503,{'content-type':'application/json'});
      res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,error:{code:-32000,message:'frozen upstream error'}}));return;
    }
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({jsonrpc:'2.0',id:rpc.id,result:rpc.method==='tools/call'?{content:[{type:'text',text:'ok'}]}:{}}));
  });
  const upstreamPort=await listen(upstream);
  const hushPort=await freePort();
  hushBase=`http://127.0.0.1:${hushPort}`;
  const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-mcp-post-audit-'));
  const child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',HUSH_ALLOW_FILE_KEY_FALLBACK:'1',HUSH_REQUIRE_LOCAL_AUTH:'0',PORT:String(hushPort),HUSH_DATA_DIR:dataDir,HUSH_MCP_UPSTREAM:`http://127.0.0.1:${upstreamPort}/mcp`,HUSH_MCP_BEARER_TOKEN:'server-only-secret',HUSH_MCP_TRUST_TOOL_ANNOTATIONS:'0'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',d=>{stderr+=d});
  const headers={'content-type':'application/json','x-hush-agent':'audit-agent','x-hush-purpose':'complete-mediation','authorization':'Bearer client-visible-token'};
  const status=async()=>await (await fetch(`${hushBase}/api/status`)).json();
  const receipts=async()=>await (await fetch(`${hushBase}/api/receipts`)).json();
  const cases=[];
  async function probe(name,body,{expectedArrivals,expectedReceiptDelta,expectedStatus=200}={}){
    const before=(await status()).receipts;
    const arrivalStart=arrivals.length;
    const response=await fetch(`${hushBase}/mcp`,{method:'POST',headers,body:typeof body==='string'?body:JSON.stringify(body)});
    let payload=null;const text=await response.text();try{payload=JSON.parse(text)}catch{payload=text}
    const after=(await status()).receipts;
    const current=await receipts();
    const fresh=current.receipts.slice(0,after-before).reverse();
    const seen=arrivals.slice(arrivalStart);
    const responseReceiptHash=response.headers.get('x-hush-receipt-hash');
    const row={name,httpStatus:response.status,upstreamArrivalDelta:seen.length,receiptDelta:after-before,receiptPhases:fresh.map(r=>r.result?.phase??null),receiptDecisions:fresh.map(r=>r.decision),arrivalReceiptCounts:seen.map(x=>x.receiptCountAtArrival),responseReceiptHashPresent:Boolean(responseReceiptHash),responseReceiptHashMatched:expectedArrivals?responseReceiptHash===fresh[1]?.hash:null,payload:summarizePayload(payload)};
    cases.push(row);
    assert.equal(response.status,expectedStatus,name);
    assert.equal(seen.length,expectedArrivals,name);
    assert.equal(after-before,expectedReceiptDelta,name);
    if(expectedArrivals){
      assert.deepEqual(fresh.map(r=>r.result?.phase),['attempt','outcome'],name);
      assert.equal(seen[0].receiptCountAtArrival,before+1,`${name}: attempt must predate arrival`);
      assert.equal(seen[0].authorization,'Bearer server-only-secret',name);
      assert.equal(responseReceiptHash,fresh[1].hash,name);
    }
    assert.equal(canonical(fresh).includes('server-only-secret'),false,`${name}: raw credential in receipt`);
    return {row,payload};
  }

  try{
    await waitFor(`${hushBase}/api/status`,child,()=>stderr);
    await probe('invalid_json','{',{expectedArrivals:0,expectedReceiptDelta:0});
    await probe('batch',[],{expectedArrivals:0,expectedReceiptDelta:0});
    await probe('invalid_request',{jsonrpc:'2.0',id:1},{expectedArrivals:0,expectedReceiptDelta:0});
    await probe('allowed_notification',{jsonrpc:'2.0',method:'notifications/initialized'},{expectedArrivals:0,expectedReceiptDelta:0,expectedStatus:202});
    await probe('unsupported_notification',{jsonrpc:'2.0',method:'notifications/other'},{expectedArrivals:0,expectedReceiptDelta:0,expectedStatus:400});
    await probe('server_discover',{jsonrpc:'2.0',id:2,method:'server/discover',params:{}},{expectedArrivals:0,expectedReceiptDelta:0});
    await probe('ping',{jsonrpc:'2.0',id:3,method:'ping',params:{}},{expectedArrivals:0,expectedReceiptDelta:0});
    await probe('initialize',{jsonrpc:'2.0',id:4,method:'initialize',params:{}},{expectedArrivals:1,expectedReceiptDelta:2});
    await probe('tools_list',{jsonrpc:'2.0',id:5,method:'tools/list',params:{}},{expectedArrivals:1,expectedReceiptDelta:2});
    await probe('unknown_method',{jsonrpc:'2.0',id:6,method:'resources/list',params:{}},{expectedArrivals:1,expectedReceiptDelta:2});
    await probe('denied_tool_call',{jsonrpc:'2.0',id:7,method:'tools/call',params:{name:'search',arguments:{q:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}}},{expectedArrivals:0,expectedReceiptDelta:1});
    const ask=await probe('approval_required_tool_call',{jsonrpc:'2.0',id:8,method:'tools/call',params:{name:'search',arguments:{q:'alpha'}}},{expectedArrivals:0,expectedReceiptDelta:0});
    const approved=await fetch(`${hushBase}/api/pending/${ask.payload.error.data.pendingId}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(approved.status,200);
    await probe('approved_tool_call',{jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'search',arguments:{q:'alpha'}}},{expectedArrivals:1,expectedReceiptDelta:2});
    const askError=await probe('approval_required_error_call',{jsonrpc:'2.0',id:10,method:'tools/call',params:{name:'search',arguments:{q:'error'}}},{expectedArrivals:0,expectedReceiptDelta:0});
    const approvedError=await fetch(`${hushBase}/api/pending/${askError.payload.error.data.pendingId}/approve`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    assert.equal(approvedError.status,200);
    await probe('approved_upstream_error',{jsonrpc:'2.0',id:11,method:'tools/call',params:{name:'search',arguments:{q:'error'}}},{expectedArrivals:1,expectedReceiptDelta:2,expectedStatus:503});

    const allReceipts=(await receipts()).receipts;
    assert.ok(allReceipts.every(r=>typeof r.signature==='string'&&r.signature.length>0),'all receipts signed');
    assert.ok(arrivals.every(x=>x.newestReceipt?.result?.phase==='attempt'),'every arrival sees attempt as newest receipt');
    assert.ok(cases.find(x=>x.name==='approved_upstream_error').receiptDecisions.at(-1)==='error');
    const result={schemaVersion:1,baseCommit:'d82712ad5b875c8505a787ab11cf50b1c4db98fe',hypothesis:'Every credentialed unary MCP POST arrival is preceded by one signed attempt and closed by one terminal outcome.',classes:cases.length,upstreamArrivals:arrivals.length,allArrivalsSawPriorAttempt:true,rawCredentialInReceipts:false,allReceiptsSigned:true,cases,arrivals:arrivals.map(({newestReceipt,...x})=>({...x,newestReceiptPhase:newestReceipt?.result?.phase??null,newestReceiptDecision:newestReceipt?.decision??null})),smallestSupportedClaim:'Across the frozen 14 protocol classes plus one required second approval precursor (15 cases total), every one of 5 brokered upstream POST arrivals had a signed attempt already durable at arrival and exactly one terminal outcome; all local and rejected classes had zero upstream arrivals.'};
    fs.writeFileSync('research/pcc-runtime-product/mcp_post_complete_mediation_result.json',`${canonical(result)}\n`);
    process.stdout.write(`${canonical(result)}\n`);
  }finally{
    if(child.exitCode==null)child.kill('SIGTERM');
    await new Promise(resolve=>upstream.close(resolve));
    fs.rmSync(dataDir,{recursive:true,force:true});
  }
}

await run();
