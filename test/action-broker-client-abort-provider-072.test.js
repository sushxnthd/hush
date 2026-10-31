import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const PROVIDER=fileURLToPath(new URL('../research/pcc-v2/hush_072_provider.mjs',import.meta.url));
const TRACE=process.env.HUSH072_TRACE_FILE;
const traces=[];
after(()=>{if(TRACE) fs.writeFileSync(TRACE,JSON.stringify({version:1,scenarios:traces},null,2)+'\n');});
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function ledgerRows(file){
  if(!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(x=>JSON.parse(x));
}
function waitPhase(child,phase){
  if(child.testMessages.some(m=>m?.phase===phase))
    return Promise.resolve(child.testMessages.find(m=>m.phase===phase));
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>done(new Error('timeout waiting '+phase)),12000);
    function done(error,msg){clearTimeout(timer);child.off('message',onMessage);child.off('exit',onExit);if(error)reject(error);else resolve(msg);}
    function onMessage(msg){if(msg?.phase===phase)done(null,msg);}
    function onExit(code,signal){done(new Error('provider exited '+code+'/'+signal+' '+child.testStderr()));}
    child.on('message',onMessage);child.on('exit',onExit);
    const cached=child.testMessages.find(m=>m?.phase===phase);
    if(cached) done(null,cached);
  });
}
async function scenario(world,{abortAndClose=true,approve=true}={}){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush072-'));
  const ledger=path.join(dir,'effects.jsonl');
  const child=fork(PROVIDER,[ledger],{stdio:['ignore','ignore','pipe','ipc'],execArgv:[]});
  child.testMessages=[];
  let stderr='';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',x=>stderr+=x);
  child.testStderr=()=>stderr;
  child.on('message',m=>child.testMessages.push(m));
  let wrapper=null;
  const order=[];
  const finished=deferred();
  let wrapperOutcome=null;
  let port=null;
  try{
    const ready=await waitPhase(child,'ready');
    const store=new EncryptedAuthorizationStateStore({file:path.join(dir,'state.json'),key:randomBytes(32)});
    const broker=new ActionBroker({authorizationStateStore:store});
    broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
    broker.registerAdapter({name:'cancel72',actions:['write'],authorizationScopes:{write:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+ready.port+'/effect',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({privateBit:world}),signal:AbortSignal.timeout(15000)
        });
        assert.equal(response.status,200);
        return response.json();
      }});
    wrapper=createServer(async(req,res)=>{
      try{
        for await(const _ of req) {}
        const ticket=broker.request({adapter:'cancel72',action:'write',transactionId:'tx',
          agent:'observer',sink:'local'});
        if(approve) broker.approve(ticket.actionId);
        const outcome=await broker.execute({actionId:ticket.actionId,agent:'observer',sink:'local'});
        wrapperOutcome=outcome;
        if(!res.destroyed){
          res.writeHead(200,{'content-type':'application/json'});
          res.end(JSON.stringify(outcome));
        }
        finished.resolve();
      }catch(error){
        finished.resolve(error);
        if(!res.destroyed){res.writeHead(500);res.end('error');}
      }
    });
    await new Promise(resolve=>wrapper.listen(0,'127.0.0.1',resolve));
    port=wrapper.address().port;
    const controller=new AbortController();
    const client=fetch('http://127.0.0.1:'+port+'/action',{
      method:'POST',body:'run',signal:controller.signal
    }).then(async r=>({completed:true,status:r.status,body:await r.json()}))
      .catch(error=>({completed:false,error:error.name}));
    let closed=false;
    if(approve){
      await waitPhase(child,'provider_arrived');
      order.push('provider_arrived');
      if(abortAndClose){
        controller.abort();
        const aborted=await client;
        assert.equal(aborted.completed,false,'client must disconnect before provider commit');
        order.push('client_abort');
        assert.equal(broker.closeAuthorizationTransaction('tx').closed,true);
        const fresh=new ActionBroker({authorizationStateStore:store});
        assert.throws(()=>fresh.registerAuthorizationTransaction({
          transactionId:'tx',worlds,globalAuthorization:parity
        }),/closed/);
        closed=true;
        order.push('durable_close');
      }
      child.send({phase:'release_commit'});
      await waitPhase(child,'provider_committed');
      order.push('provider_commit');
    }
    const clientResult=await client;
    const wrapped=await finished.promise;
    if(wrapped instanceof Error) throw wrapped;
    if(!abortAndClose||!approve) assert.equal(clientResult.completed,true);
    const rows=ledgerRows(ledger);
    assert.equal(rows.length,approve?1:0);
    if(approve) assert.equal(rows[0].bit,world);
    const trace={scenario:!approve?'unapproved':abortAndClose?'aborted_'+world:'approved_control',
      clientAborted:approve&&abortAndClose,clientCompleted:clientResult.completed,
      closed,effects:rows.length,brokerDecision:wrapperOutcome?.decision,
      resultDigestNull:wrapperOutcome?.receipt?.resultDigest===null,
      order};
    traces.push(trace);
    return {trace,clientResult,wrapperOutcome,rows};
  }finally{
    if(wrapper){
      wrapper.closeAllConnections();
      await new Promise(resolve=>wrapper.close(resolve));
    }
    if(child.exitCode===null&&!child.killed){
      const exited=once(child,'exit');
      child.kill('SIGTERM');
      await exited;
    }
    fs.rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-072: two worlds abort client, close authorization, yet provider commits', {timeout:60000},async()=>{
  const a=await scenario(0),b=await scenario(1);
  for(const x of [a,b]){
    assert.equal(x.trace.clientCompleted,false);
    assert.equal(x.trace.effects,1);
    assert.equal(x.wrapperOutcome.decision,'deny');
    assert.equal(x.wrapperOutcome.receipt.resultDigest,null);
    assert.equal(Object.hasOwn(x.wrapperOutcome,'result'),false);
    assert.deepEqual(x.trace.order,['provider_arrived','client_abort','durable_close','provider_commit']);
  }
  assert.equal(a.rows[0].bit,0);
  assert.equal(b.rows[0].bit,1);
  assert.equal(a.wrapperOutcome.reason,b.wrapperOutcome.reason);
});
test('HUSH-072: approved un-cancelled request commits and returns normally', {timeout:30000},async()=>{
  const x=await scenario(1,{abortAndClose:false});
  assert.equal(x.trace.effects,1);
  assert.equal(x.trace.clientCompleted,true);
  assert.equal(x.wrapperOutcome.decision,'allow');
  assert.equal(x.clientResult.body.result.privateBit,1);
});
test('HUSH-072: unapproved request cannot dispatch provider effect', {timeout:30000},async()=>{
  const x=await scenario(1,{approve:false});
  assert.equal(x.trace.effects,0);
  assert.equal(x.wrapperOutcome.decision,'ask');
  assert.equal(x.trace.clientCompleted,true);
});
