import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

// Synthetic private worlds. The values are not printed or exported.
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth=transactionId=>({transactionId,worlds,globalAuthorization:parity});

async function demonstrate(bit){
  const dir=mkdtempSync(join(tmpdir(),'hush063-'));
  const file=join(dir,'auth.json');
  const key=randomBytes(32);
  let effects=0;
  const server=createServer((_req,res)=>{
    effects++;
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({privateBit:bit,public:'ok'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const store=new EncryptedAuthorizationStateStore({file,key});
    const initial=new ActionBroker({authorizationStateStore:store});
    initial.registerAuthorizationTransaction(auth('tx'));
    const stale=new ActionBroker({authorizationStateStore:store});
    const originalSave=store.save.bind(store);
    let interposed=0;
    store.save=state=>{
      interposed++;
      // This callback occurs after the stale broker has successfully loaded
      // and checked durable state but before its whole-map write.
      const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
      const childCode=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH063_FILE,key:Buffer.from(process.env.HUSH063_KEY,'hex')});
const broker=new ActionBroker({authorizationStateStore:store});
if(!broker.closeAuthorizationTransaction('tx').closed)process.exit(2);
process.stdout.write('closed');`;
      const child=spawnSync(process.execPath,['--input-type=module','-e',childCode],{
        env:{...process.env,HUSH063_FILE:file,HUSH063_KEY:key.toString('hex')},
        encoding:'utf8',timeout:10000
      });
      assert.equal(child.status,0,'separate OS process must close transaction: '+child.stderr);
      assert.equal(child.stdout,'closed');
      // The closure is already durable and enforced for a new observer.
      const beforeOverwrite=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
      assert.throws(()=>beforeOverwrite.registerAuthorizationTransaction(auth('tx')),/closed/);
      // The stale writer now commits its previously checked open snapshot.
      originalSave(state);
    };
    stale.registerAuthorizationTransaction(auth('tx2'));
    assert.equal(interposed,1,'exactly one checked-save race must be injected');
    const afterOverwrite=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
    assert.equal(afterOverwrite.registerAuthorizationTransaction(auth('tx')).closed,false);
    afterOverwrite.registerAdapter({
      name:'read063',actions:['read'],authorizationScopes:{read:parity},
      execute:async()=>{
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/private');
        assert.equal(response.status,200);
        return response.json();
      }
    });
    const request=afterOverwrite.request({
      adapter:'read063',action:'read',transactionId:'tx',agent:'agent',sink:'local'
    });
    afterOverwrite.approve(request.actionId);
    const response=await afterOverwrite.execute({actionId:request.actionId,agent:'agent',sink:'local'});
    assert.equal(response.decision,'allow');
    assert.equal(response.result.privateBit,bit);
    assert.equal(effects,1);
    return {interposed,effects,decision:response.decision};
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-063: real second-process closure between check and save resurrects authorization and releases private HTTP result', {timeout:30000},async()=>{
  const a=await demonstrate(0);
  const b=await demonstrate(1);
  assert.deepEqual(a,{interposed:1,effects:1,decision:'allow'});
  assert.deepEqual(b,{interposed:1,effects:1,decision:'allow'});
});

test('HUSH-063 control: without a racing stale save, a fresh broker cannot reopen a closed transaction',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush063-control-'));
  try{
    const store=new EncryptedAuthorizationStateStore({file:join(dir,'auth.json'),key:randomBytes(32)});
    const a=new ActionBroker({authorizationStateStore:store});
    a.registerAuthorizationTransaction(auth('tx'));
    a.closeAuthorizationTransaction('tx');
    const b=new ActionBroker({authorizationStateStore:store});
    assert.throws(()=>b.registerAuthorizationTransaction(auth('tx')),/closed/);
  }finally{
    rmSync(dir,{recursive:true,force:true});
  }
});
