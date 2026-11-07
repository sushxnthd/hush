import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {EncryptedAuthorizationStateStore} from '../src/action-broker.js';
import {EffectFencedActionBroker} from '../src/effect-fenced-action-broker.js';

const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth={transactionId:'tx',worlds,globalAuthorization:parity};

function closeInIndependentProcess(file,key){
  const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
  const code=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
try {
  const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH066_FILE,key:Buffer.from(process.env.HUSH066_KEY,'hex')});
  const broker=new ActionBroker({authorizationStateStore:store});
  if(!broker.closeAuthorizationTransaction('tx').closed) process.exit(8);
  process.stdout.write('CLOSED');
} catch(error) {
  if(error.message==='AUTHORIZATION_STATE_LOCKED') {process.stdout.write('LOCKED');process.exit(0);}
  process.stderr.write(error.message);process.exit(9);
}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
    env:{...process.env,HUSH066_FILE:file,HUSH066_KEY:key.toString('hex')},
    encoding:'utf8',timeout:10000
  });
  assert.equal(child.status,0,'independent closer failed: '+child.stderr);
  return child.stdout;
}

async function scenario(secret,mode){
  const dir=mkdtempSync(join(tmpdir(),'hush066-'));
  const file=join(dir,'auth.json'),key=randomBytes(32),received=[];
  const server=createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req) body+=chunk.toString('utf8');
    received.push({body,method:req.method});
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({providerPrivate:'HUSH066_PROVIDER_ONLY'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const store=new EncryptedAuthorizationStateStore({file,key});
    const broker=new EffectFencedActionBroker({authorizationStateStore:store,secretResolver:async()=>secret});
    broker.registerAuthorizationTransaction(auth);
    const closers=[];
    const originalLoad=store.load.bind(store);
    let loads=0;
    store.load=()=>{
      loads++;
      const snapshot=originalLoad();
      if(mode==='during'&&loads===2){
        assert.equal(snapshot.transactions.find(x=>x.id==='tx').closedAt,null);
        closers.push(closeInIndependentProcess(file,key));
        assert.equal(originalLoad().transactions.find(x=>x.id==='tx').closedAt,null);
      }
      return snapshot;
    };
    broker.registerAdapter({
      name:'provider066',actions:['send'],authorizationScopes:{send:parity},
      execute:async({credentials})=>{
        const durable=originalLoad();
        assert.equal(durable.transactions.find(x=>x.id==='tx').closedAt,null);
        if(mode==='reject') throw new Error('HUSH066_SECRET_SHOULD_NOT_LEAK_'+secret);
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/provider',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({credential:credentials[0]})
        });
        return response.json();
      }
    });
    const ticket=broker.request({adapter:'provider066',action:'send',
      transactionId:'tx',agent:'agent066',sink:'sink066',credentialRefs:['opaque-066']});
    assert.equal(ticket.decision,'ask');
    broker.approve(ticket.actionId);
    if(mode==='before') closers.push(closeInIndependentProcess(file,key));
    if(mode==='orphan') writeFileSync(file+'.lock','ORPHAN\n');
    const result=await broker.execute({actionId:ticket.actionId,agent:'agent066',sink:'sink066'});
    if(mode==='orphan') unlinkSync(file+'.lock');
    assert.equal(JSON.stringify(result).includes(secret),false);
    if(result.decision!=='allow') assert.equal(JSON.stringify(result).includes('HUSH066_PROVIDER_ONLY'),false);
    if(mode==='during'||mode==='reject') closers.push(closeInIndependentProcess(file,key));
    return {decision:result.decision,reason:result.reason??null,received,closers,loads};
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-066: durable close before lock denies with zero provider effects in two worlds',{timeout:30000},async()=>{
  for(const secret of ['HUSH066_ZERO','HUSH066_ONE']){
    const r=await scenario(secret,'before');
    assert.equal(r.decision,'deny');
    assert.deepEqual(r.closers,['CLOSED']);
    assert.equal(r.received.length,0);
  }
});

test('HUSH-066: in-fence close cannot commit; effect precedes later durable closure',{timeout:30000},async()=>{
  for(const secret of ['HUSH066_ZERO','HUSH066_ONE']){
    const r=await scenario(secret,'during');
    assert.equal(r.decision,'allow');
    assert.deepEqual(r.closers,['LOCKED','CLOSED']);
    assert.equal(r.received.length,1);
    assert.equal(r.received[0].method,'POST');
    assert.deepEqual(JSON.parse(r.received[0].body),{credential:secret});
    assert.ok(r.loads>=3);
  }
});

test('HUSH-066: orphan lock denies with zero effects',{timeout:30000},async()=>{
  const r=await scenario('HUSH066_ORPHAN','orphan');
  assert.equal(r.decision,'deny');
  assert.match(r.reason,/EFFECT_FENCE_LOCK_UNAVAILABLE/);
  assert.equal(r.received.length,0);
});

test('HUSH-066: rejected adapter settles and releases lock for later closure',{timeout:30000},async()=>{
  const r=await scenario('HUSH066_REJECT','reject');
  assert.equal(r.decision,'error');
  assert.equal(r.received.length,0);
  assert.deepEqual(r.closers,['CLOSED']);
});

test('HUSH-066: abrupt process exit leaves orphan lock; restarted broker fails closed',{timeout:30000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush066-crash-'));
  const file=join(dir,'auth.json'),key=randomBytes(32);
  try{
    const first=new EffectFencedActionBroker({
      authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})
    });
    first.registerAuthorizationTransaction(auth);
    const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
    const code=`import {EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH066_FILE,key:Buffer.from(process.env.HUSH066_KEY,'hex')});
await store.withExclusiveLockAsync(async()=>{process.stdout.write('HELD');process.exit(66);});`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
      env:{...process.env,HUSH066_FILE:file,HUSH066_KEY:key.toString('hex')},
      encoding:'utf8',timeout:10000
    });
    assert.equal(child.status,66);
    assert.equal(child.stdout,'HELD');
    const store=new EncryptedAuthorizationStateStore({file,key});
    const restarted=new EffectFencedActionBroker({authorizationStateStore:store});
    let effects=0;
    restarted.registerAdapter({name:'crash066',actions:['send'],authorizationScopes:{send:parity},
      execute:async()=>{effects++;return {ok:true};}});
    const ticket=restarted.request({adapter:'crash066',action:'send',transactionId:'tx',
      agent:'agent066',sink:'sink066'});
    restarted.approve(ticket.actionId);
    const denied=await restarted.execute({actionId:ticket.actionId,agent:'agent066',sink:'sink066'});
    assert.equal(denied.decision,'deny');
    assert.match(denied.reason,/EFFECT_FENCE_LOCK_UNAVAILABLE/);
    assert.equal(effects,0);
    assert.equal(closeInIndependentProcess(file,key),'LOCKED');
    // Manual operator intervention only. No automatic stale-lock removal.
    unlinkSync(file+'.lock');
    assert.equal(closeInIndependentProcess(file,key),'CLOSED');
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('HUSH-066 negative control: provider can commit queued effect after durable revocation',{timeout:30000},async()=>{
  for(const secret of ['HUSH066_DELAYED_ZERO','HUSH066_DELAYED_ONE']){
    const dir=mkdtempSync(join(tmpdir(),'hush066-delayed-'));
    const file=join(dir,'auth.json'),key=randomBytes(32),queue=[],committed=[];
    const server=createServer(async(req,res)=>{
      let body='';
      for await(const chunk of req) body+=chunk.toString('utf8');
      queue.push(JSON.parse(body));
      res.writeHead(202,{'content-type':'application/json'});
      res.end(JSON.stringify({accepted:true}));
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const broker=new EffectFencedActionBroker({
        authorizationStateStore:new EncryptedAuthorizationStateStore({file,key}),
        secretResolver:async()=>secret
      });
      broker.registerAuthorizationTransaction(auth);
      broker.registerAdapter({name:'queue066',actions:['enqueue'],authorizationScopes:{enqueue:parity},
        execute:async({credentials})=>{
          const response=await fetch('http://127.0.0.1:'+server.address().port+'/enqueue',{
            method:'POST',headers:{'content-type':'application/json'},
            body:JSON.stringify({credential:credentials[0]})
          });
          return response.json();
        }
      });
      const ticket=broker.request({adapter:'queue066',action:'enqueue',
        transactionId:'tx',agent:'agent066',sink:'sink066',credentialRefs:['opaque-066']});
      broker.approve(ticket.actionId);
      const result=await broker.execute({actionId:ticket.actionId,agent:'agent066',sink:'sink066'});
      assert.equal(result.decision,'allow');
      assert.equal(queue.length,1);
      assert.equal(committed.length,0);
      assert.equal(closeInIndependentProcess(file,key),'CLOSED');
      // Model a provider worker processing a previously accepted job only now.
      committed.push(queue.shift());
      assert.deepEqual(committed,[{credential:secret}],
        'a queued provider-side effect can occur after durable revocation');
      assert.equal(JSON.stringify(result).includes(secret),false);
    }finally{
      await new Promise(resolve=>server.close(resolve));
      rmSync(dir,{recursive:true,force:true});
    }
  }
});

test('HUSH-066: wrong principal cannot consume a fenced ticket',{timeout:30000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush066-principal-'));
  try{
    const store=new EncryptedAuthorizationStateStore({file:join(dir,'auth.json'),key:randomBytes(32)});
    const broker=new EffectFencedActionBroker({authorizationStateStore:store});
    broker.registerAuthorizationTransaction(auth);
    let effects=0;
    broker.registerAdapter({name:'principal066',actions:['send'],authorizationScopes:{send:parity},
      execute:async()=>{effects++;return {ok:true};}});
    const ticket=broker.request({adapter:'principal066',action:'send',
      transactionId:'tx',agent:'agent066',sink:'sink066'});
    broker.approve(ticket.actionId);
    await assert.rejects(broker.execute({actionId:ticket.actionId,agent:'wrong',sink:'sink066'}),/another agent or sink/);
    assert.equal(effects,0);
    const valid=await broker.execute({actionId:ticket.actionId,agent:'agent066',sink:'sink066'});
    assert.equal(valid.decision,'allow');
    assert.equal(effects,1);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('HUSH-066: absent durable store and unscoped ticket are denied before effect',async()=>{
  const broker=new EffectFencedActionBroker();
  broker.registerAuthorizationTransaction(auth);
  let effects=0;
  broker.registerAdapter({name:'missing066',actions:['send'],authorizationScopes:{send:parity},
    execute:async()=>{effects++;return {ok:true};}});
  for(const transactionId of ['tx',null]){
    const ticket=broker.request({adapter:'missing066',action:'send',
      transactionId,agent:'agent066',sink:'sink066'});
    broker.approve(ticket.actionId);
    const result=await broker.execute({actionId:ticket.actionId,agent:'agent066',sink:'sink066'});
    assert.equal(result.decision,'deny');
  }
  assert.equal(effects,0);
});
