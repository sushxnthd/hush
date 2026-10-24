import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

// HUSH-051: deliberately vulnerable horizontally scaled *receiver* fixture.
// Do not import the Hush broker: this isolates the provider-side effect law.
// Each worker holds its own startup snapshot and uses fsynced atomic rename,
// but the workers have no shared lock or linearizable claim operation.
const workerSource = [
  "import {createServer} from 'node:http';",
  "import {readFileSync,writeFileSync,openSync,fsyncSync,closeSync,renameSync,existsSync,appendFileSync} from 'node:fs';",
  "import {dirname} from 'node:path';",
  "import {createHash} from 'node:crypto';",
  "const file=process.env.HUSH_LEDGER;const effectsFile=process.env.HUSH_EFFECTS;",
  "const hash=s=>createHash('sha256').update(s).digest('hex');",
  "let ledger=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{version:1,keys:{},effects:[]};",
  "function persist(next){const tmp=file+'.new';const fd=openSync(tmp,'w',0o600);",
  "try{writeFileSync(fd,JSON.stringify(next));fsyncSync(fd);}finally{closeSync(fd);}",
  "renameSync(tmp,file);const d=openSync(dirname(file),'r');try{fsyncSync(d);}finally{closeSync(d);}}",
  "const server=createServer(async(req,res)=>{",
  "let raw='';for await(const chunk of req)raw+=chunk;",
  "const key=req.headers['idempotency-key'];",
  "if(req.method!=='POST'||typeof key!=='string'||!key){res.writeHead(400);res.end();return;}",
  "let payload;try{payload=JSON.parse(raw);}catch{res.writeHead(400);res.end();return;}",
  "const digest=hash(JSON.stringify(payload));",
  "if(Object.hasOwn(ledger.keys,key)){",
  "if(ledger.keys[key]!==digest){res.writeHead(409);res.end('collision');return;}",
  "res.writeHead(200);res.end('replay');return;}",
  "const next={version:1,keys:{...ledger.keys,[key]:digest},effects:[...ledger.effects,{key,payload}]};",
  "persist(next);ledger=next;",
  "const fd=openSync(effectsFile,'a',0o600);",
  "try{writeFileSync(fd,JSON.stringify({key,payload})+'\\n');fsyncSync(fd);}finally{closeSync(fd);}",
  "res.writeHead(201);res.end('committed');",
  "});",
  "server.listen(0,'127.0.0.1',()=>process.send({type:'ready',port:server.address().port}));",
  "process.on('message',m=>{if(m==='stop')server.close(()=>process.exit(0));});"
].join('\n');

function sha(x){return createHash('sha256').update(x).digest('hex');}
function readLedger(file){return JSON.parse(readFileSync(file,'utf8'));}
function readEffects(file){
  if(!existsSync(file))return [];
  return readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}
async function worker(file,effects){
  const cp=spawn(process.execPath,['--input-type=module','-e',workerSource],{
    env:{...process.env,HUSH_LEDGER:file,HUSH_EFFECTS:effects},
    stdio:['ignore','ignore','pipe','ipc']
  });
  let stderr='';cp.stderr.on('data',b=>stderr+=b);
  const port=await new Promise((resolve,reject)=>{
    cp.once('message',m=>m?.type==='ready'?resolve(m.port):reject(Error('Invalid receiver readiness')));
    cp.once('error',reject);
    cp.once('exit',code=>reject(Error('Receiver exited before ready: '+code+' '+stderr)));
  });
  return {url:'http://127.0.0.1:'+port+'/effect',cp,
    stop:()=>new Promise((resolve,reject)=>{
      if(cp.exitCode!==null){resolve();return;}
      cp.once('exit',code=>code===0?resolve():reject(Error('Receiver exit '+code+' '+stderr)));
      cp.send('stop');
    })};
}
async function post(w,key,payload){
  const r=await fetch(w.url,{method:'POST',
    headers:{'content-type':'application/json','idempotency-key':key},
    body:JSON.stringify(payload)});
  await r.text();return r.status;
}

test('HUSH-051: fsynced receiver ledger without cross-worker linearizability fails idempotency',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush-051-'));
  const workers=[];
  const start=async(file,effects)=>{const w=await worker(file,effects);workers.push(w);return w;};
  try{
    // P1: both workers loaded the same empty ledger before any HTTP request.
    const sameLedger=join(dir,'same.json'),sameEffects=join(dir,'same-effects.jsonl');
    const [a,b]=await Promise.all([start(sameLedger,sameEffects),start(sameLedger,sameEffects)]);
    const key=sha('HUSH-051:operation');
    const payload={operationId:'same-operation',amount:1};
    assert.equal(await post(a,key,payload),201);
    assert.equal(await post(b,key,payload),201,'stale worker incorrectly treats same key as fresh');
    assert.equal(readEffects(sameEffects).length,2,'two externally recorded effects for same semantic key');
    assert.equal(readLedger(sameLedger).effects.length,1,'last writer masks duplicate in ledger');

    // P2: distinct keys are both acknowledged but one ledger record is lost.
    const diffLedger=join(dir,'different.json'),diffEffects=join(dir,'different-effects.jsonl');
    const [c,d]=await Promise.all([start(diffLedger,diffEffects),start(diffLedger,diffEffects)]);
    const k1=sha('HUSH-051:first'),k2=sha('HUSH-051:second');
    assert.equal(await post(c,k1,{operationId:'first'}),201);
    assert.equal(await post(d,k2,{operationId:'second'}),201);
    assert.equal(readEffects(diffEffects).length,2);
    const saved=readLedger(diffLedger);
    assert.equal(Object.keys(saved.keys).length,1,'one acknowledged key vanished from shared ledger');
    const lost=Object.hasOwn(saved.keys,k1)?k2:k1;

    // P3: a freshly started receiver cannot deduplicate the lost operation.
    const [lostPayload]=lost===k1?[{operationId:'first'}]:[{operationId:'second'}];
    const fresh=await start(diffLedger,diffEffects);
    assert.equal(await post(fresh,lost,lostPayload),201,'lost key is accepted again after restart');
    assert.equal(readEffects(diffEffects).length,3);

    // P4: single active worker provides the original local idempotency control.
    const controlLedger=join(dir,'control.json'),controlEffects=join(dir,'control-effects.jsonl');
    const solo=await start(controlLedger,controlEffects);
    const controlKey=sha('HUSH-051:control');
    assert.equal(await post(solo,controlKey,{operationId:'control'}),201);
    assert.equal(await post(solo,controlKey,{operationId:'control'}),200);
    assert.equal(readEffects(controlEffects).length,1);
    console.log(JSON.stringify({
      experiment:'HUSH-051',same_key_http_statuses:[201,201],
      same_key_external_effects:2,same_key_ledger_effects:1,
      distinct_key_http_statuses:[201,201],persisted_distinct_keys:1,
      lost_key_retry_status:201,distinct_key_external_effects_after_retry:3,
      single_worker_http_statuses:[201,200],single_worker_external_effects:1,
      interpretation:'negative control: durable rename is not a linearizable multi-worker idempotency register'
    }));
  }finally{
    for(const w of workers.reverse())await w.stop();
    rmSync(dir,{recursive:true,force:true});
  }
});
