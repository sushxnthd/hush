import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const EXPECT_RESURRECTION=process.env.HUSH062_EXPECT_RESURRECTION==='1';
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth=(transactionId)=>({transactionId,worlds,globalAuthorization:parity});

async function attack(bit){
  const dir=mkdtempSync(join(tmpdir(),'hush062-'));
  const stateFile=join(dir,'auth.json');
  const key=randomBytes(32);
  const store=new EncryptedAuthorizationStateStore({file:stateFile,key});
  let effects=0;
  const server=createServer((_req,res)=>{
    effects++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({privateBit:bit,public:'ok'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const a=new ActionBroker({authorizationStateStore:store});
    a.registerAuthorizationTransaction(auth('tx'));
    const b=new ActionBroker({authorizationStateStore:store});
    assert.equal(b.authorizationTransactions.get('tx').closedAt,null);
    // Real second OS process commits closure; broker B keeps a stale snapshot.
    const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
    const childCode=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH062_FILE,key:Buffer.from(process.env.HUSH062_KEY,'hex')});
const broker=new ActionBroker({authorizationStateStore:store});
if(!broker.closeAuthorizationTransaction('tx').closed)process.exit(2);
process.stdout.write('closed');`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',childCode],{
      env:{...process.env,HUSH062_FILE:stateFile,HUSH062_KEY:key.toString('hex')},
      encoding:'utf8',timeout:10000
    });
    assert.equal(child.status,0,'separate process must close transaction: '+child.stderr);
    assert.equal(child.stdout,'closed');
    const observer=new ActionBroker({authorizationStateStore:store});
    assert.throws(()=>observer.registerAuthorizationTransaction(auth('tx')),/closed/);
    let staleWriteRejected=false;
    try{
      b.registerAuthorizationTransaction(auth('tx2'));
    }catch(error){
      staleWriteRejected=true;
      assert.match(String(error.message),/STALE|ROLLBACK|CONFLICT|closed|durable|persist/i);
    }
    const c=new ActionBroker({authorizationStateStore:store});
    if(EXPECT_RESURRECTION){
      assert.equal(staleWriteRejected,false);
      const result=c.registerAuthorizationTransaction(auth('tx'));
      assert.equal(result.closed,false);
      c.registerAdapter({name:'read062',actions:['read'],authorizationScopes:{read:parity},
        execute:async()=>{
          const response=await fetch('http://127.0.0.1:'+server.address().port+'/private');
          assert.equal(response.status,200);
          return response.json();
        }});
      const req=c.request({adapter:'read062',action:'read',transactionId:'tx',agent:'agent',sink:'local'});
      c.approve(req.actionId);
      const response=await c.execute({actionId:req.actionId,agent:'agent',sink:'local'});
      assert.equal(response.decision,'allow');
      assert.equal(response.result.privateBit,bit);
      assert.equal(effects,1);
      return {staleWriteRejected,decision:response.decision,effects};
    }
    assert.equal(staleWriteRejected,true,'stale broker must not overwrite durable closure');
    assert.throws(()=>c.registerAuthorizationTransaction(auth('tx')),/closed/);
    assert.equal(effects,0);
    const fresh=c.registerAuthorizationTransaction(auth('tx2'));
    assert.equal(fresh.closed,false,'fresh broker may add an unrelated transaction');
    const after=new ActionBroker({authorizationStateStore:store});
    assert.throws(()=>after.registerAuthorizationTransaction(auth('tx')),/closed/);
    return {staleWriteRejected,decision:'deny',effects};
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-062: stale writer must not resurrect closed authorization and disclose real HTTP result', {timeout:20000},async()=>{
  const a=await attack(0),b=await attack(1);
  assert.equal(a.staleWriteRejected,!EXPECT_RESURRECTION);
  assert.equal(b.staleWriteRejected,!EXPECT_RESURRECTION);
  assert.equal(a.effects,EXPECT_RESURRECTION?1:0);
  assert.equal(b.effects,EXPECT_RESURRECTION?1:0);
  // Two distinct private worlds are exercised without logging either result.
});

test('HUSH-062: fresh broker can persist new transaction without reopening closure', {timeout:20000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush062-control-'));
  try{
    const store=new EncryptedAuthorizationStateStore({file:join(dir,'auth.json'),key:randomBytes(32)});
    const a=new ActionBroker({authorizationStateStore:store});
    a.registerAuthorizationTransaction(auth('tx'));
    a.closeAuthorizationTransaction('tx');
    const b=new ActionBroker({authorizationStateStore:store});
    b.registerAuthorizationTransaction(auth('tx2'));
    const c=new ActionBroker({authorizationStateStore:store});
    assert.throws(()=>c.registerAuthorizationTransaction(auth('tx')),/closed/);
    assert.equal(c.registerAuthorizationTransaction(auth('tx2')).closed,false);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});


test('HUSH-062: disappearing known durable state cannot bootstrap stale open state',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush062-missing-'));
  try{
    const file=join(dir,'auth.json');
    const store=new EncryptedAuthorizationStateStore({file,key:randomBytes(32)});
    const a=new ActionBroker({authorizationStateStore:store});
    a.registerAuthorizationTransaction(auth('tx'));
    const stale=new ActionBroker({authorizationStateStore:store});
    unlinkSync(file);
    assert.throws(()=>stale.registerAuthorizationTransaction(auth('tx2')),/STALE_WRITER_CONFLICT/);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
