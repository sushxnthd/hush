import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

const files=['sealed-context.json','vault.json','authority-state.enc.json','receipts.json'];
const phases=['before-write','after-write','after-file-fsync','before-rename','after-rename'];
const cases=files.flatMap(file=>phases.map(phase=>({file,phase})));
function integer(name,fallback,min){const value=Number(process.env[name]??fallback);assert.ok(Number.isSafeInteger(value)&&value>=min,`${name} must be an integer >= ${min}`);return value;}
const durationMs=integer('HUSH_SOAK_DURATION_MS',30000,1);
const maxIterations=integer('HUSH_SOAK_MAX_ITERATIONS',1000000,1);
const pauseMs=integer('HUSH_SOAK_PAUSE_MS',0,0);
const requireFullDuration=process.env.HUSH_SOAK_REQUIRE_FULL_DURATION==='1';
const segment=integer('HUSH_SOAK_SEGMENT',1,1);
const persistent=Boolean(process.env.HUSH_SOAK_DIR);
const root=persistent?path.resolve(process.env.HUSH_SOAK_DIR):fs.mkdtempSync(path.join(os.tmpdir(),'hush-soak-'));
const fixtureFile=path.join(root,'fixture.json');
const progressFile=path.join(root,'progress.json');
const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const started=Date.now();
let progress,child,current,iterations=0,crashes=0,failure=null;
// Refuse user data directories: only an empty directory or our marked synthetic fixture is accepted.
if(fs.existsSync(fixtureFile)){
  assert.equal(JSON.parse(fs.readFileSync(fixtureFile,'utf8')).schema,'hush.synthetic-soak-fixture.v1');
  assert.ok(fs.existsSync(progressFile),'Cannot resume without a completed checkpoint');
  progress=JSON.parse(fs.readFileSync(progressFile,'utf8'));
  assert.equal(progress.commit,commit,'Soak source commit changed');
  assert.equal(progress.segment+1,segment,'Segments must run in sequence');
  assert.equal(progress.status,'pass','Cannot resume failed evidence');
}else{
  assert.equal(segment,1,'Missing previous segment');
  if(fs.existsSync(root)) assert.equal(fs.readdirSync(root).length,0,'Refusing a nonempty unmarked directory');
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  fs.writeFileSync(fixtureFile,JSON.stringify({schema:'hush.synthetic-soak-fixture.v1',
    passphrase:'synthetic-'+crypto.randomBytes(24).toString('hex'),vaultKey:crypto.randomBytes(32).toString('hex')}),{mode:0o600});
  progress={commit,segment:0,startedAt:new Date(started).toISOString(),activeMs:0,totalIterations:0,totalCrashes:0,coverage:{},snapshot:null};
}
function waitMessage(worker){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(new Error('Worker message timed out'));},30000);
    function cleanup(){clearTimeout(timer);worker.off('message',message);worker.off('exit',exit);worker.off('error',error);}
    function message(value){cleanup();value.type==='error'?reject(new Error(value.message)):resolve(value);}
    function exit(code,signal){cleanup();reject(new Error(`Worker exited before checkpoint: ${code}/${signal}`));}
    function error(value){cleanup();reject(value);}
    worker.once('message',message);worker.once('exit',exit);worker.once('error',error);
  });
}
async function startWorker(){
  // No credential-store commands: this fixture uses a development key in its own directory.
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>key.toLowerCase()!=='path'));
  env.PATH='';env.NODE_ENV='development';env.HUSH_ALLOW_FILE_KEY_FALLBACK='1';
  child=fork(fileURLToPath(new URL('./soak-worker.mjs',import.meta.url)),[root],{env,stdio:['ignore','ignore','inherit','ipc']});
  const ready=await waitMessage(child);assert.equal(ready.type,'ready');return ready.snapshot;
}
async function stopWorker(kill=false){
  if(!child||child.exitCode!==null||child.signalCode!==null)return;
  const worker=child;
  const exit=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{worker.kill('SIGKILL');reject(new Error('Worker exit timed out'));},10000);
    worker.once('exit',(code,signal)=>{clearTimeout(timer);resolve({code,signal});});
  });
  if(kill)assert.equal(worker.kill('SIGKILL'),true);else worker.send({type:'stop'});
  const result=await exit;
  if(!kill)assert.equal(result.code,0);else assert.ok(result.signal==='SIGKILL'||process.platform==='win32');
}
function checkRecovery(before,after,{interrupted=false}={}){
  for(const field of ['context','vault','authority','receipts']){
    assert.ok(Number.isSafeInteger(after[field]),`Invalid ${field} checkpoint`);
    assert.ok(after[field]>=before[field],`${field} lost an acknowledged write`);
    assert.ok(after[field]<=before[field]+1,`${field} advanced unexpectedly`);
    if(!interrupted)assert.equal(after[field],before[field]);
  }
  if(after.receipts===before.receipts)assert.equal(after.receiptHead,before.receiptHead,'Receipt chain rolled back or changed');
}
function cleanAbandonedTemps(){
  for(const dir of ['context','vault','store']){
    const base=path.join(root,dir);
    for(const name of fs.readdirSync(base))if(files.some(file=>name.startsWith(file+'.')&&name.endsWith('.tmp')))fs.rmSync(path.join(base,name));
  }
}
try{
  current=await startWorker();
  if(progress.snapshot)checkRecovery(progress.snapshot,current);
  while(iterations<maxIterations&&Date.now()-started<durationMs){
    const fault=cases[progress.totalCrashes%cases.length];
    const response=waitMessage(child);child.send({type:'cycle',fault});
    const event=await response;assert.equal(event.type,'fault');assert.deepEqual(event.fault,fault);
    await stopWorker(true);crashes++;progress.totalCrashes++;
    const recovered=await startWorker();checkRecovery(current,recovered,{interrupted:true});
    cleanAbandonedTemps();
    const ack=waitMessage(child);child.send({type:'cycle'});
    const committed=await ack;assert.equal(committed.type,'committed');
    for(const field of ['context','vault','authority','receipts'])assert.equal(committed.snapshot[field],recovered[field]+1);
    current=committed.snapshot;
    await stopWorker();const reopened=await startWorker();checkRecovery(current,reopened);current=reopened;
    iterations++;progress.totalIterations++;
    const key=`${fault.file}:${fault.phase}`;progress.coverage[key]=(progress.coverage[key]??0)+1;
    if(iterations%20===0)console.log(`Verified ${progress.totalCrashes} process crashes; ${Object.keys(progress.coverage).length}/20 boundaries`);
    if(pauseMs)await sleep(Math.min(pauseMs,Math.max(0,durationMs-(Date.now()-started))));
  }
  if(requireFullDuration)assert.ok(Date.now()-started>=durationMs,'Soak ended before the required duration');
}catch(error){failure=error;process.exitCode=1;}
finally{try{await stopWorker();}catch(error){failure??=error;process.exitCode=1;}}
const elapsedMs=Date.now()-started;
progress={...progress,segment,status:failure?'fail':'pass',snapshot:current??progress.snapshot,activeMs:progress.activeMs+elapsedMs};
const wallMs=Date.now()-Date.parse(progress.startedAt);
const coverageComplete=Object.keys(progress.coverage).length===cases.length;
const report={schema:'hush.durability-soak.v2',status:progress.status,commit,segment,startedAt:new Date(started).toISOString(),
  completedAt:new Date().toISOString(),requestedDurationMs:durationMs,elapsedMs,requireFullDuration,fullDurationSatisfied:elapsedMs>=durationMs,
  iterations,crashes,totalIterations:progress.totalIterations,totalCrashes:progress.totalCrashes,cumulativeActiveMs:progress.activeMs,
  wallMs,coverage:progress.coverage,coverageComplete,
  full72HourSatisfied:!failure&&progress.activeMs>=259200000&&wallMs>=259200000&&coverageComplete,
  scope:'Synthetic encrypted fixture; real process kills at filesystem write boundaries; not physical power loss or an independent security review',
  failure:failure?.message??null};
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/soak.json',JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(progressFile,JSON.stringify(progress,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
if(!persistent)fs.rmSync(root,{recursive:true,force:true});
