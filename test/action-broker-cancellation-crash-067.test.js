import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {EncryptedAuthorizationStateStore,ActionBroker} from '../src/action-broker.js';
import {EffectFencedActionBroker} from '../src/effect-fenced-action-broker.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth={transactionId:'tx',worlds,globalAuthorization:parity};
const moduleAction=new URL('../src/action-broker.js',import.meta.url).href;
const moduleFenced=new URL('../src/effect-fenced-action-broker.js',import.meta.url).href;

function emitTrace(caseName,world,events,details){
  const trace={case:caseName,world,events,details};
  const encoded=JSON.stringify(trace);
  assert.equal(encoded.includes('HUSH067_CREDENTIAL_'),false,'trace leaked a synthetic credential');
  if(process.env.HUSH067_TRACE_OUT) appendFileSync(process.env.HUSH067_TRACE_OUT,encoded+'\n');
}

function independentClose(file,key){
  const code=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleAction)};
try {
  const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH067_FILE,key:Buffer.from(process.env.HUSH067_KEY,'hex')});
  const broker=new ActionBroker({authorizationStateStore:store});
  if(!broker.closeAuthorizationTransaction('tx').closed) process.exit(8);
  process.stdout.write('CLOSED');
} catch(error) {
  if(error.message==='AUTHORIZATION_STATE_LOCKED'){process.stdout.write('LOCKED');process.exit(0);}
  process.stderr.write(error.message);process.exit(9);
}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
    env:{...process.env,HUSH067_FILE:file,HUSH067_KEY:key.toString('hex')},
    encoding:'utf8',timeout:12000
  });
  assert.equal(child.status,0,'independent revoker failed: '+child.stderr);
  return child.stdout;
}

function makeProvider(events){
  let resolveReceived;
  const received=new Promise(resolve=>{resolveReceived=resolve;});
  const queue=[];
  const server=createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req) body+=chunk.toString('utf8');
    queue.push(JSON.parse(body));
    events.push('provider_received');
    resolveReceived();
    // Intentionally withhold the HTTP response: provider already accepted work.
    // The provider is allowed to commit later, independent of the client socket.
    res.on('error',()=>{});
  });
  return {server,received,queue};
}

async function start(server){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return server.address().port;
}
async function stop(server){
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
}
async function waitFor(promise,label){
  let timer;
  try{
    return await Promise.race([promise,new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('TIMEOUT_'+label)),12000);
    })]);
  }finally{clearTimeout(timer);}
}

test('HUSH-067: real HTTP AbortController cannot retract provider-accepted work',{timeout:40000},async()=>{
  for(const world of ['zero','one']){
    const secret='HUSH067_CREDENTIAL_'+world;
    const dir=mkdtempSync(join(tmpdir(),'hush067-abort-'));
    const file=join(dir,'auth.json'),key=randomBytes(32),events=[];
    const {server,received,queue}=makeProvider(events);
    try{
      const port=await start(server);
      const controller=new AbortController();
      const broker=new EffectFencedActionBroker({
        authorizationStateStore:new EncryptedAuthorizationStateStore({file,key}),
        secretResolver:async()=>secret
      });
      broker.registerAuthorizationTransaction(auth);
      broker.registerAdapter({name:'abort067',actions:['send'],authorizationScopes:{send:parity},
        execute:async({credentials})=>{
          const response=await fetch('http://127.0.0.1:'+port+'/queue',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({credential:credentials[0]}),signal:controller.signal
          });
          return response.json();
        }
      });
      const ticket=broker.request({adapter:'abort067',action:'send',transactionId:'tx',
        agent:'agent067',sink:'sink067',credentialRefs:['opaque-067']});
      broker.approve(ticket.actionId);
      const executing=broker.execute({actionId:ticket.actionId,agent:'agent067',sink:'sink067'});
      await waitFor(received,'PROVIDER_RECEIPT');
      assert.deepEqual(queue,[{credential:secret}]);
      controller.abort();
      events.push('client_aborted');
      const result=await waitFor(executing,'ABORT_SETTLEMENT');
      events.push('broker_error');
      assert.equal(result.decision,'error');
      assert.equal(JSON.stringify(result).includes(secret),false);
      assert.equal(independentClose(file,key),'CLOSED');
      events.push('durable_closed');
      const committed=queue.shift();
      assert.deepEqual(committed,{credential:secret});
      events.push('provider_committed');
      assert.deepEqual(events,['provider_received','client_aborted','broker_error','durable_closed','provider_committed']);
      emitTrace('abort_after_receipt',world,events,{brokerDecision:result.decision,commits:1,closed:true});
    }finally{
      await stop(server);
      rmSync(dir,{recursive:true,force:true});
    }
  }
});

test('HUSH-067: real broker process death leaves orphan lock but cannot retract accepted work',{timeout:50000},async()=>{
  for(const world of ['zero','one']){
    const secret='HUSH067_CREDENTIAL_'+world;
    const dir=mkdtempSync(join(tmpdir(),'hush067-kill-'));
    const file=join(dir,'auth.json'),key=randomBytes(32),events=[];
    const {server,received,queue}=makeProvider(events);
    let child;
    try{
      const port=await start(server);
      const first=new EffectFencedActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
      first.registerAuthorizationTransaction(auth);
      const code=`import {EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleAction)};
import {EffectFencedActionBroker} from ${JSON.stringify(moduleFenced)};
const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH067_FILE,key:Buffer.from(process.env.HUSH067_KEY,'hex')});
const broker=new EffectFencedActionBroker({authorizationStateStore:store,secretResolver:async()=>process.env.HUSH067_SECRET});
broker.registerAdapter({name:'kill067',actions:['send'],authorizationScopes:{send:${JSON.stringify(parity)}},
  execute:async({credentials})=>{
    const response=await fetch('http://127.0.0.1:'+process.env.HUSH067_PORT+'/queue',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:credentials[0]})
    });
    return response.json();
  }
});
const ticket=broker.request({adapter:'kill067',action:'send',transactionId:'tx',
  agent:'agent067',sink:'sink067',credentialRefs:['opaque-067']});
broker.approve(ticket.actionId);
await broker.execute({actionId:ticket.actionId,agent:'agent067',sink:'sink067'});`;
      child=spawn(process.execPath,['--input-type=module','-e',code],{
        env:{...process.env,HUSH067_FILE:file,HUSH067_KEY:key.toString('hex'),
          HUSH067_PORT:String(port),HUSH067_SECRET:secret},
        stdio:['ignore','pipe','pipe']
      });
      let stderr='';
      child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
      const childExit=new Promise((resolve,reject)=>{
        child.once('error',reject);
        child.once('exit',(code,signal)=>resolve({code,signal}));
      });
      await waitFor(Promise.race([received,childExit.then(exit=>{throw new Error('CHILD_EXIT_BEFORE_PROVIDER_RECEIPT '+JSON.stringify(exit)+' '+stderr);})]),'CHILD_RECEIPT');
      assert.deepEqual(queue,[{credential:secret}]);
      assert.equal(existsSync(file+'.lock'),true);
      assert.equal(child.kill(),true);
      await waitFor(childExit,'CHILD_EXIT');
      events.push('child_killed');
      assert.equal(existsSync(file+'.lock'),true,'crashed broker must not silently remove orphan fence');
      const restarted=new EffectFencedActionBroker({
        authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})
      });
      let unexpectedEffects=0;
      restarted.registerAdapter({name:'restart067',actions:['send'],authorizationScopes:{send:parity},
        execute:async()=>{unexpectedEffects++;return {ok:true};}
      });
      const ticket=restarted.request({adapter:'restart067',action:'send',transactionId:'tx',
        agent:'agent067',sink:'sink067'});
      restarted.approve(ticket.actionId);
      const result=await restarted.execute({actionId:ticket.actionId,agent:'agent067',sink:'sink067'});
      assert.equal(result.decision,'deny');
      assert.match(result.reason,/EFFECT_FENCE_LOCK_UNAVAILABLE/);
      assert.equal(unexpectedEffects,0);
      events.push('restart_denied');
      assert.equal(independentClose(file,key),'LOCKED');
      events.push('revocation_locked');
      const committed=queue.shift();
      assert.deepEqual(committed,{credential:secret});
      events.push('provider_committed');
      assert.deepEqual(events,['provider_received','child_killed','restart_denied','revocation_locked','provider_committed']);
      emitTrace('kill_after_receipt',world,events,{restartDecision:result.decision,commits:1,revocation:'LOCKED'});
    }finally{
      if(child&&!child.killed) child.kill();
      await stop(server);
      rmSync(dir,{recursive:true,force:true});
    }
  }
});
