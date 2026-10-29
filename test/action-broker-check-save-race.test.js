import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

// HUSH-063 historical race is preserved in HUSH_063_FROZEN/RESULT.
// HUSH-064 changes this regression's expected outcome to denial.
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth=transactionId=>({transactionId,worlds,globalAuthorization:parity});

function closer(file,key,expectLocked){
  const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
  const code=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
try{
  const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH064_FILE,key:Buffer.from(process.env.HUSH064_KEY,'hex')});
  const broker=new ActionBroker({authorizationStateStore:store});
  if(!broker.closeAuthorizationTransaction('tx').closed)process.exit(3);
  process.stdout.write('closed');
}catch(error){
  if(error.message==='AUTHORIZATION_STATE_LOCKED'){process.stdout.write('locked');process.exit(0);}
  process.stderr.write(error.message);process.exit(4);
}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
    env:{...process.env,HUSH064_FILE:file,HUSH064_KEY:key.toString('hex')},
    encoding:'utf8',timeout:10000
  });
  assert.equal(child.status,0,'child failed: '+child.stderr);
  assert.equal(child.stdout,expectLocked?'locked':'closed');
}

async function demonstrate(bit){
  const dir=mkdtempSync(join(tmpdir(),'hush064-'));
  const file=join(dir,'auth.json');
  const key=randomBytes(32);
  let effects=0;
  const server=createServer((_req,res)=>{
    effects++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({privateBit:bit}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const store=new EncryptedAuthorizationStateStore({file,key});
    new ActionBroker({authorizationStateStore:store}).registerAuthorizationTransaction(auth('tx'));
    const stale=new ActionBroker({authorizationStateStore:store});
    const originalSave=store.save.bind(store);
    let interposed=0;
    store.save=state=>{
      interposed++;
      // A separate OS process cannot close while the stale writer owns
      // the same atomic lock covering both durable check and save.
      closer(file,key,true);
      originalSave(state);
    };
    stale.registerAuthorizationTransaction(auth('tx2'));
    assert.equal(interposed,1);
    // Once the lock is released, closure by a separate process is durable.
    closer(file,key,false);
    const observer=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
    assert.throws(()=>observer.registerAuthorizationTransaction(auth('tx')),/closed/);
    observer.registerAdapter({
      name:'read064',actions:['read'],authorizationScopes:{read:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/private');
        return response.json();
      }
    });
    assert.throws(()=>observer.request({
      adapter:'read064',action:'read',transactionId:'tx',agent:'agent',sink:'local'
    }),/closed/);
    assert.equal(effects,0);
    return {interposed,effects,decision:'deny'};
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-064: second OS process cannot revoke between durable check/save; later revocation remains closed', {timeout:30000},async()=>{
  assert.deepEqual(await demonstrate(0),{interposed:1,effects:0,decision:'deny'});
  assert.deepEqual(await demonstrate(1),{interposed:1,effects:0,decision:'deny'});
});

test('HUSH-064: orphan lock fails closed; no age/PID-based automatic break',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush064-orphan-'));
  try{
    const file=join(dir,'auth.json');
    const store=new EncryptedAuthorizationStateStore({file,key:randomBytes(32)});
    const broker=new ActionBroker({authorizationStateStore:store});
    broker.registerAuthorizationTransaction(auth('tx'));
    writeFileSync(file+'.lock','999999\\n');
    assert.throws(()=>broker.closeAuthorizationTransaction('tx'),/AUTHORIZATION_STATE_LOCKED/);
    const stillOpen=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key:store.key})});
    assert.equal(stillOpen.registerAuthorizationTransaction(auth('tx')).closed,false);
    unlinkSync(file+'.lock'); // manual operator recovery, simulated by test
    broker.closeAuthorizationTransaction('tx');
    const observer=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key:store.key})});
    assert.throws(()=>observer.registerAuthorizationTransaction(auth('tx')),/closed/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('HUSH-064: stale broker cannot overwrite a closure that commits before its lock',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush064-stale-'));
  try{
    const file=join(dir,'auth.json'),key=randomBytes(32);
    const first=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
    first.registerAuthorizationTransaction(auth('tx'));
    const stale=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
    first.closeAuthorizationTransaction('tx');
    assert.throws(()=>stale.registerAuthorizationTransaction(auth('tx2')),/AUTHORIZATION_STATE_STALE_WRITER_CONFLICT/);
    const observer=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
    assert.throws(()=>observer.registerAuthorizationTransaction(auth('tx')),/closed/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
