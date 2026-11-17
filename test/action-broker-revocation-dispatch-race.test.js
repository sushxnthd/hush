import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

// HUSH-065: this is an EXPECTED COUNTEREXAMPLE, not a passing security guarantee.
// No user data or external network: only synthetic credentials and loopback HTTP.
const worlds=['00','01','10','11'];
const parity={'00':0,'01':1,'10':1,'11':0};
const auth={transactionId:'tx',worlds,globalAuthorization:parity};

function closeInIndependentProcess(file,key){
  const moduleUrl=new URL('../src/action-broker.js',import.meta.url).href;
  const code=`import {ActionBroker,EncryptedAuthorizationStateStore} from ${JSON.stringify(moduleUrl)};
const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH065_FILE,key:Buffer.from(process.env.HUSH065_KEY,'hex')});
const broker=new ActionBroker({authorizationStateStore:store});
const result=broker.closeAuthorizationTransaction('tx');
if(!result.closed) process.exit(7);
process.stdout.write('CLOSED');`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{
    env:{...process.env,HUSH065_FILE:file,HUSH065_KEY:key.toString('hex')},
    encoding:'utf8',timeout:10000
  });
  assert.equal(child.status,0,'independent closer failed: '+child.stderr);
  assert.equal(child.stdout,'CLOSED');
}

async function scenario(secret,{interpose}){
  const dir=mkdtempSync(join(tmpdir(),'hush065-'));
  const file=join(dir,'authorization.json');
  const key=randomBytes(32);
  const received=[];
  const server=createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req) body+=chunk.toString('utf8');
    received.push({method:req.method,body});
    res.writeHead(200,{'content-type':'application/json'});
    res.end(JSON.stringify({privateProviderResult:'HUSH065_PROVIDER_ONLY'}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const store=new EncryptedAuthorizationStateStore({file,key});
    const broker=new ActionBroker({authorizationStateStore:store,secretResolver:async()=>secret});
    broker.registerAuthorizationTransaction(auth);
    let closureBeforeDispatch=false;
    broker.registerAdapter({
      name:'provider065',actions:['send'],authorizationScopes:{send:parity},
      execute:async({credentials})=>{
        // Independent read, before HTTP. No effect may be attributed to a late close.
        const durable=new EncryptedAuthorizationStateStore({file,key}).load();
        assert.notEqual(durable.transactions.find(x=>x.id==='tx')?.closedAt,null);
        closureBeforeDispatch=true;
        const response=await fetch('http://127.0.0.1:'+server.address().port+'/provider',{
          method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({credential:credentials[0]})
        });
        return response.json();
      }
    });
    const ticket=broker.request({
      adapter:'provider065',action:'send',transactionId:'tx',
      agent:'agent065',sink:'sink065',credentialRefs:['opaque-ref-065']
    });
    assert.equal(ticket.decision,'ask');
    broker.approve(ticket.actionId);
    const originalLoad=store.load.bind(store);
    let checks=0;
    if(interpose){
      store.load=()=>{
        checks++;
        const snapshot=originalLoad();
        if(checks===2){
          assert.equal(snapshot.transactions.find(x=>x.id==='tx').closedAt,null);
          closeInIndependentProcess(file,key);
          assert.notEqual(originalLoad().transactions.find(x=>x.id==='tx').closedAt,null);
        }
        return snapshot;
      };
    }else{
      closeInIndependentProcess(file,key);
    }
    const result=await broker.execute({actionId:ticket.actionId,agent:'agent065',sink:'sink065'});
    assert.equal(result.decision,'deny');
    assert.equal(result.receipt?.resultDigest,null);
    assert.equal(JSON.stringify(result).includes(secret),false);
    assert.equal(JSON.stringify(result).includes('HUSH065_PROVIDER_ONLY'),false);
    return {checks,closureBeforeDispatch,received};
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
}

test('HUSH-065 expected counterexample: revoked private credential reaches provider in both worlds', {timeout:30000},async()=>{
  for(const secret of ['HUSH065_PRIVATE_ZERO','HUSH065_PRIVATE_ONE']){
    const result=await scenario(secret,{interpose:true});
    assert.ok(result.checks>=3);
    assert.equal(result.closureBeforeDispatch,true);
    assert.equal(result.received.length,1,'a post-revocation HTTP effect must be witnessed');
    assert.equal(result.received[0].method,'POST');
    assert.deepEqual(JSON.parse(result.received[0].body),{credential:secret});
  }
});

test('HUSH-065 control: revocation before first scope check suppresses all provider effects', {timeout:30000},async()=>{
  const result=await scenario('HUSH065_PRIVATE_CONTROL',{interpose:false});
  assert.equal(result.closureBeforeDispatch,false);
  assert.equal(result.received.length,0);
});
