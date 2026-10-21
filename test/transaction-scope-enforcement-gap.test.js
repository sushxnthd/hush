import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import test from 'node:test';

test('paired production traces expose the frozen transaction-scope gap',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-scope-gap-'));
  try{
    const primary=path.join(dir,'primary.json');
    const audit=path.join(dir,'audit.json');
    execFileSync(process.execPath,['scripts/verify-transaction-scope-gap.mjs','--output',primary],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
    execFileSync(process.execPath,['scripts/audit-transaction-scope-gap.mjs','--primary',primary,'--output',audit],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
    const result=JSON.parse(fs.readFileSync(primary,'utf8'));
    assert.equal(result.counts.brokerVisibleMismatches,0);
    assert.equal(result.counts.oracleContractSeparations,2);
    assert.equal(JSON.parse(fs.readFileSync(audit,'utf8')).status,'pass');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
