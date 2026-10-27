import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

const WORKER=fileURLToPath(new URL('./fixtures/hush056-crash-worker.mjs',import.meta.url));

function ledgerRows(file){
  if(!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf8').trim().split('\n')
    .filter(Boolean).map(line=>JSON.parse(line));
}
function spawnWorker(ledger,mode,policy){
  const child=fork(WORKER,[ledger,mode,policy],{
    stdio:['ignore','pipe','pipe','ipc'],execArgv:[]
  });
  let stderr='';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.testStderr=()=>stderr;
  return child;
}
function waitPhase(child,phase){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>finish(new Error('Timed out waiting for '+phase)),8000);
    function finish(error,message){
      clearTimeout(timeout);
      child.off('message',onMessage);
      child.off('exit',onExit);
      if(error) reject(error); else resolve(message);
    }
    function onMessage(message){
      if(message?.phase===phase) finish(null,message);
    }
    function onExit(code,signal){
      finish(new Error('Worker exited before '+phase+': '+code+'/'+signal+
                       '; '+child.testStderr()));
    }
    child.on('message',onMessage);
    child.on('exit',onExit);
  });
}
async function crashAfterEffect(ledger,policy){
  const child=spawnWorker(ledger,'crash',policy);
  try{
    const effect=await waitPhase(child,'effect_committed');
    const independentlyRead=ledgerRows(ledger);
    assert.equal(independentlyRead.length,1);
    assert.equal(independentlyRead[0].key,effect.requestHash);
    assert.equal(effect.applied,true);
    assert.equal(child.exitCode,null,'worker must still be running before kill');
    const exit=once(child,'exit');
    assert.equal(child.kill('SIGKILL'),true);
    const [code,signal]=await exit;
    assert.equal(code,null);
    assert.equal(signal,'SIGKILL');
    return effect;
  }finally{
    if(child.exitCode===null&&!child.killed) child.kill('SIGKILL');
  }
}
async function replayAfterCrash(ledger,policy){
  const child=spawnWorker(ledger,'replay',policy);
  try{
    const effect=await waitPhase(child,'effect_committed');
    const done=await waitPhase(child,'done');
    const [code,signal]=await once(child,'exit');
    assert.equal(code,0,child.testStderr());
    assert.equal(signal,null);
    assert.equal(done.receipts,1);
    assert.equal(done.decision,'allow');
    assert.equal(done.requestHash,effect.requestHash);
    return {effect,done};
  }finally{
    if(child.exitCode===null&&!child.killed) child.kill('SIGKILL');
  }
}
async function withLedger(fn){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush056-'));
  const ledger=path.join(dir,'provider-effects.jsonl');
  try{return await fn(ledger);}
  finally{fs.rmSync(dir,{recursive:true,force:true});}
}

test('HUSH-056: actual process crash then reapproval duplicates unprotected provider effect',async()=>{
  await withLedger(async ledger=>{
    const before=await crashAfterEffect(ledger,'unprotected');
    const after=await replayAfterCrash(ledger,'unprotected');
    assert.equal(before.requestHash,after.done.requestHash);
    assert.equal(after.effect.applied,true);
    const rows=ledgerRows(ledger);
    assert.equal(rows.length,2);
    assert.equal(rows[0].key,rows[1].key);
    assert.equal(rows[0].effect,'durable-provider-effect');
    assert.equal(rows[1].effect,'durable-provider-effect');
  });
});

test('HUSH-056: durable provider idempotency suppresses duplicate effect on replay',async()=>{
  await withLedger(async ledger=>{
    const before=await crashAfterEffect(ledger,'idempotent');
    const after=await replayAfterCrash(ledger,'idempotent');
    assert.equal(before.requestHash,after.done.requestHash);
    assert.equal(after.effect.applied,false);
    assert.equal(ledgerRows(ledger).length,1);
  });
});

test('HUSH-056: missing broker receipt after crash does not imply no provider effect',async()=>{
  await withLedger(async ledger=>{
    const before=await crashAfterEffect(ledger,'unprotected');
    const rows=ledgerRows(ledger);
    assert.equal(rows.length,1);
    assert.equal(rows[0].key,before.requestHash);
    // The first worker was killed before its adapter returned to ActionBroker.
    // No completed broker receipt was sent; the effect nevertheless persisted.
    assert.equal(before.phase,'effect_committed');
  });
});
