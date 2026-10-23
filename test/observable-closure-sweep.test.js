import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';

test('frozen observable-closure sweep and independent checker agree',()=>{
  const dir=mkdtempSync(join(tmpdir(),'hush-closure-'));
  const output=join(dir,'sweep.json');
  try{
    execFileSync(process.execPath,['research/observable-closure/run-sweep.mjs',output],{stdio:'pipe'});
    const result=JSON.parse(readFileSync(output,'utf8'));
    assert.deepEqual(result.totals,result.prediction);
    const checked=JSON.parse(execFileSync(process.execPath,['research/observable-closure/independent-check.mjs',output],{encoding:'utf8'}));
    assert.equal(checked.ok,true);
    assert.deepEqual(checked.expected,result.totals);
  }finally{ rmSync(dir,{recursive:true,force:true}); }
});
