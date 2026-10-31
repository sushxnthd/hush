import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ActionBroker} from '../src/action-broker.js';

const provider=fileURLToPath(new URL('../research/pcc-v2/hush_070_provider.mjs',import.meta.url));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(file,mode,crashFirst){
  const child=spawn(process.execPath,[provider],{env:{...process.env,HUSH070_FILE:file,HUSH070_MODE:mode,
    HUSH070_CRASH_FIRST:crashFirst?'1':'0'},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',x=>stderr+=x.toString());
  let timer;
  const port=await Promise.race([new Promise((resolve,reject)=>{
    let out='';child.stdout.on('data',x=>{out+=x.toString();const m=/PORT (\d+)/.exec(out);if(m)resolve(Number(m[1]));});
    child.on('error',reject);child.on('exit',(code,signal)=>reject(Error('PROVIDER_EXIT '+code+' '+signal+' '+stderr)));
  }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('START_TIMEOUT')),10000)})]).finally(()=>clearTimeout(timer));
  return {child,base:'http://127.0.0.1:'+port};
}
async function stop(rep){
  if(!rep||rep.child.exitCode!==null||rep.child.signalCode!==null)return;
  const done=new Promise(r=>rep.child.once('exit',r));rep.child.kill();await Promise.race([done,sleep(2000)]);
}
function state(file){return JSON.parse(readFileSync(file,'utf8'));}
async function execute(base,key){
  const secret='HUSH070_TEST_CREDENTIAL';
  const broker=new ActionBroker({secretResolver:async()=>secret});
  broker.registerAdapter({name:'provider070',actions:['effect'],execute:async({credentials})=>{
    const r=await fetch(base+'/effect',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({idempotency_key:key,credential:credentials[0]})});
    if(!r.ok)throw Error('PROVIDER_REJECTED');
    return await r.json();
  }});
  const ticket=broker.request({adapter:'provider070',action:'effect',agent:'a070',sink:'s070',credentialRefs:['opaque070']});
  broker.approve(ticket.actionId);
  return broker.execute({actionId:ticket.actionId,agent:'a070',sink:'s070'});
}
async function fixture(mode,crashFirst,fn){
  const dir=mkdtempSync(join(tmpdir(),'hush070-')),file=join(dir,'state.json');
  writeFileSync(file,JSON.stringify({v:1,effects:0,crashes:0,keys:[]}));
  let p;try{p=await start(file,mode,crashFirst);await fn({file,p,restart:async()=>{await stop(p);p=await start(file,mode,false);return p;}})}
  finally{await stop(p);rmSync(dir,{recursive:true,force:true});}
}

test('HUSH-070 post-effect lost ACK duplicates effect under naive provider retry',{timeout:30000},async()=>{
  await fixture('naive',true,async({file,p,restart})=>{
    let first;try{first=await execute(p.base,'HUSH070_CASE_A')}catch{first=null}
    assert.notEqual(first?.decision,'allow');
    assert.equal(state(file).effects,1);
    p=await restart();const second=await execute(p.base,'HUSH070_CASE_A');
    assert.equal(second.decision,'allow');assert.equal(state(file).effects,2);
  });
});

test('HUSH-070 provider idempotency prevents duplicate after crash/restart',{timeout:30000},async()=>{
  await fixture('guarded',true,async({file,p,restart})=>{
    let first;try{first=await execute(p.base,'HUSH070_CASE_B')}catch{first=null}
    assert.notEqual(first?.decision,'allow');
    assert.equal(state(file).effects,1);assert.deepEqual(state(file).keys,['HUSH070_CASE_B']);
    p=await restart();const second=await execute(p.base,'HUSH070_CASE_B');
    assert.equal(second.decision,'allow');assert.equal(state(file).effects,1);
  });
});

test('HUSH-070 normal guarded execution is single effect',{timeout:30000},async()=>{
  await fixture('guarded',false,async({file,p})=>{
    const first=await execute(p.base,'HUSH070_CASE_C');assert.equal(first.decision,'allow');
    const second=await execute(p.base,'HUSH070_CASE_C');assert.equal(second.decision,'allow');
    assert.equal(state(file).effects,1);
  });
});

test('HUSH-070 provider rejects invalid operation key',{timeout:30000},async()=>{
  await fixture('guarded',false,async({file,p})=>{
    const r=await fetch(p.base+'/effect',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({idempotency_key:'bad',credential:'HUSH070_TEST_CREDENTIAL'})});
    assert.equal(r.status,400);assert.equal(state(file).effects,0);
  });
});
