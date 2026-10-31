import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';

// A real process restart is essential: same-process reinitialization alone
// does not demonstrate a crash/acknowledgement-loss window.
const child = `
import {ActionBroker,EncryptedAuthorizationStateStore} from './src/action-broker.js';
const parity={'00':0,'01':1,'10':1,'11':0};
const store=new EncryptedAuthorizationStateStore({
  file:process.env.HUSH_STATE_FILE,
  key:Buffer.from(process.env.HUSH_STATE_KEY,'hex')
});
const broker=new ActionBroker({authorizationStateStore:store});
broker.registerAdapter({
  name:'crash48',actions:['post'],
  authorizationScopes:{post:parity},
  execute:async({arguments:args})=>{
    const response=await fetch(process.env.HUSH_RECEIVER,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({operationId:args.operationId})
    });
    if(response.status!==204) throw new Error('Receiver did not commit effect');
    if(process.env.HUSH_CRASH==='1') process.exit(66);
    return {committed:true};
  }
});
if(!broker.authorizationTransactions.has('tx')){
  broker.registerAuthorizationTransaction({
    transactionId:'tx',worlds:['00','01','10','11'],
    globalAuthorization:parity
  });
}
const req=broker.request({
  adapter:'crash48',action:'post',transactionId:'tx',
  agent:'retry-client',sink:'local-http',
  arguments:{operationId:'fixed-operation-048'}
});
broker.approve(req.actionId);
const result=await broker.execute({
  actionId:req.actionId,agent:'retry-client',sink:'local-http'
});
if(result.decision!=='allow') throw new Error('Expected approved action');
console.log(JSON.stringify({status:result.decision,requestHash:req.requestHash}));
`;

async function runChild(env){
  return await new Promise((resolve,reject)=>{
    const cp=spawn(process.execPath,['--input-type=module','-e',child],{
      cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe']
    });
    let stdout='',stderr='';
    cp.stdout.on('data',b=>{stdout+=b;});
    cp.stderr.on('data',b=>{stderr+=b;});
    cp.on('error',reject);
    cp.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));
  });
}

test('fresh-process retry duplicates a committed external effect after lost acknowledgement',async()=>{
  const received=[];
  const server=createServer(async(req,res)=>{
    let body='';
    for await(const chunk of req) body+=chunk;
    received.push(JSON.parse(body));
    res.writeHead(204);
    res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=mkdtempSync(join(tmpdir(),'hush-048-'));
  const env={
    HUSH_STATE_FILE:join(dir,'authorization.json'),
    HUSH_STATE_KEY:randomBytes(32).toString('hex'),
    HUSH_RECEIVER:`http://127.0.0.1:${server.address().port}/effect`
  };
  try{
    const crashed=await runChild({...env,HUSH_CRASH:'1'});
    assert.equal(crashed.code,66,`first child must die after external commit: ${crashed.stderr}`);
    assert.equal(received.length,1,'first real effect must precede crash');
    assert.equal(existsSync(env.HUSH_STATE_FILE),true,'authorization state persisted');
    const retry=await runChild({...env,HUSH_CRASH:'0'});
    assert.equal(retry.code,0,`fresh process must authorize retry: ${retry.stderr}`);
    assert.equal(received.length,2,'restarted broker lacks durable effect deduplication');
    assert.deepEqual(received,[{operationId:'fixed-operation-048'},
                              {operationId:'fixed-operation-048'}]);
    assert.equal(JSON.parse(retry.stdout).status,'allow');
  }finally{
    await new Promise(resolve=>server.close(resolve));
    rmSync(dir,{recursive:true,force:true});
  }
});
