import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AuthorityState } from '../src/authority-state.js';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'hush-authority-'));}

test('grant uses and revocations persist across restart without plaintext grant ids',()=>{
  const dir=temp(); const key=crypto.randomBytes(32);
  try{
    const first=new AuthorityState(dir,key);
    assert.equal(first.useCount('grant-super-secret-id'),0);
    assert.equal(first.incrementUse('grant-super-secret-id'),1);
    first.revoke('revoked-super-secret-id');
    const raw=fs.readFileSync(path.join(dir,'authority-state.enc.json'),'utf8');
    assert.doesNotMatch(raw,/grant-super-secret-id|revoked-super-secret-id/);
    const second=new AuthorityState(dir,key);
    assert.equal(second.useCount('grant-super-secret-id'),1);
    assert.equal(second.isRevoked('revoked-super-secret-id'),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('authority state fails closed on ciphertext tampering or wrong key',()=>{
  const dir=temp(); const key=crypto.randomBytes(32);
  try{
    const state=new AuthorityState(dir,key);state.incrementUse('g1');
    assert.throws(()=>new AuthorityState(dir,crypto.randomBytes(32)),/auth|authenticate|Unsupported|decrypt|bad/i);
    const file=path.join(dir,'authority-state.enc.json');
    const blob=JSON.parse(fs.readFileSync(file,'utf8'));
    blob.ciphertext=blob.ciphertext.slice(0,-2)+'AA';
    fs.writeFileSync(file,JSON.stringify(blob));
    assert.throws(()=>new AuthorityState(dir,key));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
