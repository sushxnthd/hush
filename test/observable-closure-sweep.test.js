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
    assert.deepEqual(result,JSON.parse(readFileSync('research/observable-closure/raw/sweep.json','utf8')));
    const checked=JSON.parse(execFileSync(process.execPath,['research/observable-closure/independent-check.mjs',output],{encoding:'utf8'}));
    assert.equal(checked.ok,true);
    assert.deepEqual(checked.expected,result.totals);
    assert.deepEqual(checked,JSON.parse(readFileSync('research/observable-closure/derived/independent-check.json','utf8')));
  }finally{ rmSync(dir,{recursive:true,force:true}); }
});
