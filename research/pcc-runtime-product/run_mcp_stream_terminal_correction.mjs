import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const canonical=value=>JSON.stringify(stable(value),null,2)+'\n';
async function listen(server){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});return server.address().port}
async function freePort(){const server=http.createServer();const port=await listen(server);await new Promise(resolve=>server.close(resolve));return port}
async function closeServer(server,sockets){for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve))}
async function exited(child){if(child.exitCode!=null)return;await new Promise(resolve=>child.once('exit',resolve))}
function startHush({port,dataDir,upstreamPort}){
  const child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'test',HUSH_ALLOW_FILE_KEY_FALLBACK:'1',HUSH_REQUIRE_LOCAL_AUTH:'0',PORT:String(port),HUSH_DATA_DIR:dataDir,HUSH_MCP_UPSTREAM:'http://127.0.0.1:'+upstreamPort+'/mcp',HUSH_MCP_BEARER_TOKEN:'server-only-secret'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk});return {child,stderr:()=>stderr};
}
async function waitFor(base,runtime){
  for(let i=0;i<240;i+=1){if(runtime.child.exitCode!=null)throw Error('Hush exited '+runtime.child.exitCode+': '+runtime.stderr());try{if((await fetch(base+'/api/status')).ok)return}catch{}await sleep(50)}
  throw Error('Hush did not start: '+runtime.stderr());
}
async function receipts(base){return await (await fetch(base+'/api/receipts')).json()}
function streamProjection(payload){
  return payload.receipts.slice().reverse().filter(item=>item.request?.action==='http_get'&&item.result?.streamId).map(item=>({
    decision:item.decision,phase:item.result.phase,status:item.result.status??null,streamState:item.result.streamState??null,
    streamTerminal:item.result.streamTerminal??null,terminalReason:item.result.terminalReason??null,reconciled:item.result.reconciled??false,
    upstreamStatus:item.result.upstreamStatus??null,signed:Boolean(item.signature),rawCredentialIncluded:item.result.rawCredentialIncluded
  }));
}
function validateProjection(rows,expected){
  assert.equal(rows.filter(row=>row.phase==='attempt').length,1);
  assert.equal(rows.filter(row=>row.phase==='opened').length,1);
  assert.equal(rows.filter(row=>row.phase==='terminal').length,1);
  assert.equal(rows.find(row=>row.phase==='terminal').streamTerminal,expected);
}
async function liveScenario(mode){
  const sockets=new Set();let base=null;const arrivals=[];
  const upstream=http.createServer(async(request,response)=>{
    const atArrival=await receipts(base);
    arrivals.push({priorAttempts:streamProjection(atArrival).filter(row=>row.phase==='attempt').length,chainValid:atArrival.chainValid,authorizationBrokered:request.headers.authorization==='Bearer server-only-secret'});
    response.writeHead(200,{'content-type':'text/event-stream'});
    response.write('event: message\ndata: first\n\n');
    if(mode==='clean_eof'){await sleep(35);response.end('event: message\ndata: second\n\n')}
    else if(mode==='upstream_abort'){await sleep(35);response.destroy(new Error('frozen upstream failure'))}
    else if(mode==='race_upstream_first'){await sleep(40);response.destroy(new Error('frozen upstream-first race'))}
  });
  upstream.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket))});
  const upstreamPort=await listen(upstream);const port=await freePort();const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-terminal-'+mode+'-'));
  const runtime=startHush({port,dataDir,upstreamPort});base='http://127.0.0.1:'+port;
  try{
    await waitFor(base,runtime);let delivered='';let clientTerminal=null;
    await new Promise((resolve,reject)=>{
      const request=http.get(base+'/mcp?case='+mode,{headers:{authorization:'Bearer client-secret','x-hush-agent':'terminal-correction','x-hush-purpose':mode}});
      request.on('response',response=>{
        response.on('data',chunk=>{
          delivered+=chunk.toString();
          if(mode==='client_cancel'){clientTerminal='cancelled';response.destroy();request.destroy();resolve()}
          if(mode==='race_upstream_first')setTimeout(()=>{if(!response.destroyed){response.destroy();request.destroy()}},45);
        });
        response.on('end',()=>{clientTerminal='complete';resolve()});
        response.on('aborted',()=>{clientTerminal??='aborted';resolve()});
        response.on('error',()=>{clientTerminal??='error';resolve()});
      });
      request.on('error',error=>{if(mode==='client_cancel'||mode==='race_upstream_first'||clientTerminal)resolve();else reject(error)});
    });
    await sleep(160);const final=await receipts(base);const projection=streamProjection(final);
    const expected=mode==='clean_eof'?'complete':mode==='client_cancel'?'cancelled':'error';validateProjection(projection,expected);
    return {mode,expected,clientTerminal,firstEventDelivered:delivered.includes('data: first'),secondEventDelivered:delivered.includes('data: second'),arrivals,projection,chainValid:final.chainValid,rawCredentialPersisted:JSON.stringify(final.receipts).includes('server-only-secret')||JSON.stringify(final.receipts).includes('client-secret')};
  }finally{
    if(runtime.child.exitCode==null){runtime.child.kill('SIGTERM');await exited(runtime.child)}
    await closeServer(upstream,sockets);fs.rmSync(dataDir,{recursive:true,force:true});
  }
}
async function crashScenario(){
  const sockets=new Set();let base=null;const arrivals=[];
  const upstream=http.createServer(async(request,response)=>{
    const atArrival=await receipts(base);arrivals.push({priorAttempts:streamProjection(atArrival).filter(row=>row.phase==='attempt').length,chainValid:atArrival.chainValid,authorizationBrokered:request.headers.authorization==='Bearer server-only-secret'});
    response.writeHead(200,{'content-type':'text/event-stream'});response.write('event: message\ndata: first\n\n');
  });
  upstream.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket))});
  const upstreamPort=await listen(upstream);const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-terminal-crash-'));
  try{
    const firstPort=await freePort();base='http://127.0.0.1:'+firstPort;let runtime=startHush({port:firstPort,dataDir,upstreamPort});await waitFor(base,runtime);
    const request=http.get(base+'/mcp?case=crash',{headers:{'x-hush-agent':'terminal-correction','x-hush-purpose':'crash_reconciliation'}});
    await new Promise((resolve,reject)=>{request.on('response',response=>response.once('data',resolve));request.on('error',reject)});
    const before=await receipts(base);assert.equal(streamProjection(before).filter(row=>row.phase==='terminal').length,0);
    runtime.child.kill('SIGKILL');await exited(runtime.child);
    const secondPort=await freePort();base='http://127.0.0.1:'+secondPort;runtime=startHush({port:secondPort,dataDir,upstreamPort});await waitFor(base,runtime);
    const after=await receipts(base);const once=streamProjection(after);validateProjection(once,'error');
    const terminal=once.find(row=>row.phase==='terminal');assert.equal(terminal.reconciled,true);assert.equal(terminal.terminalReason,'process_restart');
    runtime.child.kill('SIGTERM');await exited(runtime.child);
    const thirdPort=await freePort();base='http://127.0.0.1:'+thirdPort;runtime=startHush({port:thirdPort,dataDir,upstreamPort});await waitFor(base,runtime);
    const repeated=await receipts(base);const twice=streamProjection(repeated);validateProjection(twice,'error');assert.deepEqual(twice,once);
    runtime.child.kill('SIGTERM');await exited(runtime.child);
    return {mode:'process_crash',arrivals,beforeRestart:streamProjection(before),afterRestart:once,afterSecondRestart:twice,chainValid:after.chainValid&&repeated.chainValid,rawCredentialPersisted:JSON.stringify(repeated.receipts).includes('server-only-secret')};
  }finally{await closeServer(upstream,sockets);fs.rmSync(dataDir,{recursive:true,force:true})}
}
const scenarios=[];
for(const mode of ['clean_eof','upstream_abort','client_cancel','race_upstream_first'])scenarios.push(await liveScenario(mode));
const crash=await crashScenario();scenarios.push(crash);
const gate=scenarios.every(item=>item.chainValid&&!item.rawCredentialPersisted&&item.arrivals.length===1&&item.arrivals[0].priorAttempts===1&&item.arrivals[0].chainValid&&item.arrivals[0].authorizationBrokered)&&crash.afterRestart.filter(row=>row.phase==='terminal').length===1&&crash.afterSecondRestart.filter(row=>row.phase==='terminal').length===1;
const result={protocol:'hush.mcp-stream-terminal-correction.v1',classification:'REAL_SERVER_ADVERSARIAL_LIFECYCLE_AND_CRASH_TEST',scenarios,scientificGate:gate?'PASS_EXACTLY_ONCE_TERMINAL_STREAM_MEDIATION':'FAIL_TERMINAL_STREAM_MEDIATION',smallestClaim:gate?'For the frozen MCP GET lifecycle partition, Hush records a prior attempt and exactly one signed terminal complete, error, or cancelled state; an opened stream interrupted by process death is idempotently reconciled to error on restart.':'At least one frozen lifecycle or crash-reconciliation gate failed.'};
const output=canonical(result);if(process.argv[2])fs.writeFileSync(process.argv[2],output);process.stdout.write(output);assert.equal(gate,true);
