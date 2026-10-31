import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,readFileSync,mkdirSync,rmSync,appendFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ActionBroker} from '../src/action-broker.js';

const replica=fileURLToPath(new URL('../research/pcc-v2/hush_069_provider_replica.mjs',import.meta.url));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function start(file,mode){
  const child=spawn(process.execPath,[replica],{env:{...process.env,HUSH069_FILE:file,HUSH069_MODE:mode},stdio:['ignore','pipe','pipe']});
  let stderr='';child.stderr.on('data',x=>{stderr+=x.toString()});
  let timer;
  const port=await Promise.race([new Promise((resolve,reject)=>{
    let buf='';child.stdout.on('data',x=>{buf+=x.toString();const m=/PORT (\d+)/.exec(buf);if(m)resolve(Number(m[1]));});
    child.on('error',reject);child.on('exit',(code,signal)=>reject(Error('REPLICA_EXIT '+code+' '+signal+' '+stderr)));
  }),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('REPLICA_START_TIMEOUT '+stderr)),10000)})]).finally(()=>clearTimeout(timer));
  return {child,base:'http://127.0.0.1:'+port};
}
async function stop(replica){
  if(!replica)return;
  const c=replica.child;if(c.exitCode!==null||c.signalCode!==null)return;
  const done=new Promise(resolve=>c.once('exit',resolve));c.kill();
  await Promise.race([done,sleep(3000)]);
}
async function request(base,path,method='POST',data){
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json'},
    ...(data?{body:JSON.stringify(data)}:{})});
  return {code:r.status,data:await r.json()};
}
async function phase(base,want){
  for(let i=0;i<200;i++){
    const p=await request(base,'/phase','GET');if(p.data.phase===want)return;
    await sleep(25);
  }
  throw Error('WAIT_PHASE_TIMEOUT_'+want);
}
function state(file){return JSON.parse(readFileSync(file,'utf8'))}
function trace(kind,world,events,s){
  const record={case:kind,world,events,effects:s.effects,revoked:s.revoked,epoch:s.epoch};
  const json=JSON.stringify(record);
  assert.equal(json.includes('HUSH069_TEST_'),false);
  if(process.env.HUSH069_TRACE_OUT)appendFileSync(process.env.HUSH069_TRACE_OUT,json+'\n');
  return record;
}
async function brokerEnqueue(base,secret){
  const broker=new ActionBroker({secretResolver:async()=>secret});
  broker.registerAdapter({name:'provider069',actions:['enqueue'],execute:async({credentials})=>{
    const r=await request(base,'/enqueue','POST',{credential:credentials[0]});
    if(r.code!==202)throw Error('PROVIDER_REFUSED');return {queued:true};
  }});
  const t=broker.request({adapter:'provider069',action:'enqueue',agent:'a069',sink:'s069',credentialRefs:['opaque069']});
  broker.approve(t.actionId);
  const result=await broker.execute({actionId:t.actionId,agent:'a069',sink:'s069'});
  assert.equal(result.decision,'allow');
  assert.equal(JSON.stringify(result).includes(secret),false);
}
async function fixture(mode,fn){
  const dir=mkdtempSync(join(tmpdir(),'hush069-')),file=join(dir,'provider.json');
  writeFileSync(file,JSON.stringify({v:1,revoked:false,pending:0,effects:0,epoch:0}));
  let c,r;
  try{
    c=await start(file,mode);r=await start(file,mode);
    return await fn({file,c,r});
  }finally{await stop(c);await stop(r);rmSync(dir,{recursive:true,force:true});}
}

test('HUSH-069 stale provider check permits post-revocation effect and resurrects authority',{timeout:50000},async()=>{
  for(const world of ['zero','one'])await fixture('stale',async({file,c,r})=>{
    const events=[];
    await brokerEnqueue(c.base,'HUSH069_TEST_'+world);events.push('enqueued');
    const commit=request(c.base,'/commit');await phase(c.base,'checked');events.push('commit_checked');
    assert.equal((await request(r.base,'/revoke')).code,200);events.push('revoked');
    assert.equal(state(file).revoked,true);
    assert.equal((await request(c.base,'/release')).code,200);events.push('released');
    assert.equal((await commit).code,200);events.push('effect_committed');
    const s=state(file);assert.equal(s.effects,1);assert.equal(s.revoked,false);assert.equal(s.epoch,0);
    trace('stale_race',world,events,s);
  });
});

test('HUSH-069 shared-lock commit guard denies post-revocation effect',{timeout:50000},async()=>{
  for(const world of ['zero','one'])await fixture('guarded',async({file,c,r})=>{
    const events=[];
    await brokerEnqueue(c.base,'HUSH069_TEST_'+world);events.push('enqueued');
    const commit=request(c.base,'/commit');await phase(c.base,'waiting');events.push('commit_waiting');
    assert.equal((await request(r.base,'/revoke')).code,200);events.push('revoked');
    assert.equal((await request(c.base,'/release')).code,200);events.push('released');
    assert.equal((await commit).code,403);events.push('commit_denied');
    const s=state(file);assert.equal(s.effects,0);assert.equal(s.revoked,true);assert.equal(s.epoch,1);
    trace('guarded_revoke_first',world,events,s);
  });
});

test('HUSH-069 commit before revocation is allowed and subsequent revocation survives',{timeout:50000},async()=>{
  await fixture('guarded',async({file,c,r})=>{
    const events=[];
    await brokerEnqueue(c.base,'HUSH069_TEST_zero');events.push('enqueued');
    const commit=request(c.base,'/commit');await phase(c.base,'waiting');events.push('commit_waiting');
    assert.equal((await request(c.base,'/release')).code,200);events.push('released');
    assert.equal((await commit).code,200);events.push('effect_committed');
    assert.equal((await request(r.base,'/revoke')).code,200);events.push('revoked');
    const s=state(file);assert.equal(s.effects,1);assert.equal(s.revoked,true);assert.equal(s.epoch,1);
    trace('guarded_commit_first','zero',events,s);
  });
});

test('HUSH-069 crashed waiting replica cannot commit after revocation and restart',{timeout:50000},async()=>{
  await fixture('guarded',async({file,c,r})=>{
    const events=[];
    await brokerEnqueue(c.base,'HUSH069_TEST_zero');events.push('enqueued');
    const commit=request(c.base,'/commit').catch(()=>null);await phase(c.base,'waiting');events.push('commit_waiting');
    assert.equal((await request(r.base,'/revoke')).code,200);events.push('revoked');
    await stop(c);await commit;events.push('commit_process_killed');
    const restarted=await start(file,'guarded');
    try{
      const second=request(restarted.base,'/commit');await phase(restarted.base,'waiting');
      assert.equal((await request(restarted.base,'/release')).code,200);
      assert.equal((await second).code,403);events.push('restart_denied');
      const s=state(file);assert.equal(s.effects,0);assert.equal(s.revoked,true);
      trace('guarded_crash_restart','zero',events,s);
    }finally{await stop(restarted);}
  });
});

test('HUSH-069 orphan provider lock denies revocation and effect rather than bypassing',{timeout:50000},async()=>{
  await fixture('guarded',async({file,c,r})=>{
    const events=[];await brokerEnqueue(c.base,'HUSH069_TEST_zero');
    mkdirSync(file+'.lock');events.push('orphan_lock');
    assert.equal((await request(r.base,'/revoke')).code,503);events.push('revocation_denied');
    const commit=request(c.base,'/commit');await phase(c.base,'waiting');
    assert.equal((await request(c.base,'/release')).code,200);
    assert.equal((await commit).code,503);events.push('commit_denied');
    const s=state(file);assert.equal(s.effects,0);assert.equal(s.revoked,false);
    trace('orphan_lock','zero',events,s);
  });
});
