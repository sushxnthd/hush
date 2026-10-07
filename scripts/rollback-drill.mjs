import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRollbackSnapshot,hashStateDirectory,restoreRollbackSnapshot,verifyRollbackSnapshot} from '../src/update-safety.js';

const startedAt=new Date().toISOString();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-rollback-drill-'));
const dataDir=path.join(work,'user-data');
const snapshotDir=path.join(work,'snapshot');
let report;

try{
  fs.mkdirSync(path.join(dataDir,'context'),{recursive:true});
  fs.writeFileSync(path.join(dataDir,'vault.enc'),crypto.randomBytes(4096));
  fs.writeFileSync(path.join(dataDir,'context','state.enc'),crypto.randomBytes(8192));
  fs.writeFileSync(path.join(dataDir,'receipts.json'),JSON.stringify([{hash:'before-update',decision:'allow'}]));
  fs.writeFileSync(path.join(dataDir,'runtime.lock'),'ephemeral lock');
  const before=hashStateDirectory(dataDir);

  createRollbackSnapshot({dataDir,snapshotDir,release:{version:'pre-update',commit:'synthetic-drill'}});
  assert.equal(verifyRollbackSnapshot(snapshotDir).valid,true);

  fs.writeFileSync(path.join(dataDir,'vault.enc'),crypto.randomBytes(1024));
  fs.rmSync(path.join(dataDir,'context'),{recursive:true,force:true});
  fs.writeFileSync(path.join(dataDir,'new-format.json'),'{"schema":999}');
  assert.notEqual(hashStateDirectory(dataDir),before);

  const restored=restoreRollbackSnapshot({snapshotDir,dataDir});
  const after=hashStateDirectory(dataDir);
  assert.equal(after,before);
  assert.equal(fs.existsSync(path.join(dataDir,'new-format.json')),false);
  assert.equal(fs.existsSync(path.join(dataDir,'runtime.lock')),false,'runtime lock must not be restored');

  const tampered=path.join(snapshotDir,'state','vault.enc');
  fs.appendFileSync(tampered,'tamper');
  const tamperCheck=verifyRollbackSnapshot(snapshotDir);
  assert.equal(tamperCheck.valid,false);
  assert.match(tamperCheck.reason,/mismatch/i);

  report={schema:'hush.rollback-drill.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),exactStateRestored:true,ephemeralLockExcluded:true,tamperRejected:true,restoredFiles:restored.files,stateDigest:after};
}catch(error){
  report={schema:'hush.rollback-drill.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),error:error?.message||String(error)};
  process.exitCode=1;
}finally{fs.rmSync(work,{recursive:true,force:true});}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/rollback-drill.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
