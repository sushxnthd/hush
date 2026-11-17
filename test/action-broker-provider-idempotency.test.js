import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,openSync,fsyncSync,closeSync,renameSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';

// Controlled receiver-owned durable ledger: effect and idempotency decision
// are one local state transition. This is NOT a third-party provider guarantee.
function sha(value){return createHash('sha256').update(value).digest('hex');}
function readLedger(file){
  return existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{version:1,keys:{},effects:[]};
}
function persistLedger(file,ledger){
  const tmp=file+'.new';
  const fd=openSync(tmp,'w',0o600);
  try{
    writeFileSync(fd,JSON.stringify(ledger));
    fsyncSync(fd);
  }finally{closeSync(fd);}
  renameSync(tmp,file);
  // Directory fsync is a POSIX durability primitive. Windows does not expose
  // an equivalent directory handle through Node's fs API; the file itself is
  // already fsynced before the atomic rename.
  if(process.platform!=='win32'){
    const dir=openSync(dirname(file),'r');
    try{fsyncSync(dir);}finally{closeSync(dir);}
  }
}
async function receiver(file){
  const ledger=readLedger(file);
  const requests=[];
  const server=createServer(async(req,res)=>{
    let raw='';
    for await(const chunk of req)raw+=chunk;
    const key=req.headers['idempotency-key'];
    if(req.method!=='POST'||typeof key!=='string'||!key){
      res.writeHead(400);res.end('missing idempotency key');return;
    }
    let payload;
    try{payload=JSON.parse(raw);}catch{res.writeHead(400);res.end('invalid JSON');return;}
    if(typeof payload.operationId!=='string'||!payload.operationId){
      res.writeHead(400);res.end('missing operation');return;
    }
    const digest=sha(JSON.stringify(payload));
    requests.push({key,payload});
    if(Object.hasOwn(ledger.keys,key)){
      if(ledger.keys[key]!==digest){res.writeHead(409);res.end('key collision');return;}
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({committed:false,replay:true}));return;
    }
    // A single local durable transaction includes both the effect log and key.
    const next={version:1,keys:{...ledger.keys,[key]:digest},
                effects:[...ledger.effects,{key,payload}]};
    try{persistLedger(file,next);}
    catch{res.writeHead(503);res.end('durable commit failed');return;}
    ledger.keys=next.keys;ledger.effects=next.effects;
    res.writeHead(201,{'content-type':'application/json'});
    res.end(JSON.stringify({committed:true,replay:false}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {url:'http://127.0.0.1:'+server.address().port+'/effect',requests,
          close:()=>new Promise(resolve=>server.close(resolve))};
}

const child=[
"import {ActionBroker,EncryptedAuthorizationStateStore} from './src/action-broker.js';",
"import {createHash} from 'node:crypto';",
"const parity={'00':0,'01':1,'10':1,'11':0};",
"const store=new EncryptedAuthorizationStateStore({file:process.env.HUSH_STATE_FILE,key:Buffer.from(process.env.HUSH_STATE_KEY,'hex')});",
"const broker=new ActionBroker({authorizationStateStore:store});",
"broker.registerAdapter({name:'provider50',actions:['post'],authorizationScopes:{post:parity},execute:async({arguments:args})=>{",
"const stableKey=createHash('sha256').update('HUSH-050:'+args.operationId).digest('hex');",
"const response=await fetch(process.env.HUSH_RECEIVER,{method:'POST',headers:{'content-type':'application/json','idempotency-key':stableKey},body:JSON.stringify({operationId:args.operationId,amount:1})});",
"if(![200,201].includes(response.status))throw Error('Receiver rejected operation: '+response.status);",
"const result=await response.json();",
"if(process.env.HUSH_CRASH==='1')process.exit(66);",
"return result;}});",
"if(!broker.authorizationTransactions.has('tx'))broker.registerAuthorizationTransaction({transactionId:'tx',worlds:['00','01','10','11'],globalAuthorization:parity});",
"const request=broker.request({adapter:'provider50',action:'post',transactionId:'tx',agent:'client50',sink:'receiver50',arguments:{operationId:'fixed-operation-050'}});",
"broker.approve(request.actionId);",
"const result=await broker.execute({actionId:request.actionId,agent:'client50',sink:'receiver50'});",
"if(result.decision!=='allow')throw Error('Expected approved retry');",
"console.log(JSON.stringify({decision:result.decision}));"
].join('\n');
async function runChild(env){
  return await new Promise((resolve,reject)=>{
    const cp=spawn(process.execPath,['--input-type=module','-e',child],{
      cwd:process.cwd(),env:{...process.env,...env},stdio:['ignore','pipe','pipe']
    });
    let stdout='',stderr='';
    cp.stdout.on('data',b=>stdout+=b);
    cp.stderr.on('data',b=>stderr+=b);
    cp.on('error',reject);
    cp.on('close',(code,signal)=>resolve({code,signal,stdout,stderr}));
  });
}

test('HUSH-050: receiver-owned durable idempotency suppresses duplicate effects across two process restarts',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush-050-'));
  const ledgerFile=join(dir,'receiver-ledger.json');
  const env={
    HUSH_STATE_FILE:join(dir,'authorization.json'),
    HUSH_STATE_KEY:randomBytes(32).toString('hex')
  };
  let server=null;
  try{
    server=await receiver(ledgerFile);
    const crashed=await runChild({...env,HUSH_RECEIVER:server.url,HUSH_CRASH:'1'});
    assert.equal(crashed.code,66,'P1 broker crashed after provider commit: '+crashed.stderr);
    assert.equal(server.requests.length,1);
    assert.equal(readLedger(ledgerFile).effects.length,1);
    await server.close();server=null;
    // Fresh receiver instance: in-memory state discarded and reloaded from disk.
    server=await receiver(ledgerFile);
    const retry=await runChild({...env,HUSH_RECEIVER:server.url,HUSH_CRASH:'0'});
    assert.equal(retry.code,0,'P2 broker restarted and retried: '+retry.stderr);
    assert.equal(JSON.parse(retry.stdout).decision,'allow');
    assert.equal(server.requests.length,1,'second receiver saw a second real HTTP POST');
    assert.equal(readLedger(ledgerFile).effects.length,1,'replayed semantic operation has one external effect');
    const originalKey=sha('HUSH-050:fixed-operation-050');
    const collision=await fetch(server.url,{method:'POST',
      headers:{'content-type':'application/json','idempotency-key':originalKey},
      body:JSON.stringify({operationId:'fixed-operation-050',amount:2})});
    assert.equal(collision.status,409,'P3 changed payload under same key rejected');
    const missing=await fetch(server.url,{method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({operationId:'new-operation',amount:1})});
    assert.equal(missing.status,400,'P4 missing key rejected');
    assert.equal(readLedger(ledgerFile).effects.length,1);
    const distinct=await fetch(server.url,{method:'POST',
      headers:{'content-type':'application/json','idempotency-key':sha('HUSH-050:new-operation')},
      body:JSON.stringify({operationId:'new-operation',amount:1})});
    assert.equal(distinct.status,201);
    assert.equal(readLedger(ledgerFile).effects.length,2,'P3 distinct operation commits exactly once');
  }finally{
    if(server)await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
