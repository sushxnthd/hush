import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getOrCreateSigningKeys } from '../src/signing-keys.js';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'hush-signing-'));}

test('signing private key is stored encrypted and remains stable across restart',()=>{
  const dir=temp(),root=crypto.randomBytes(32);
  try{
    const first=getOrCreateSigningKeys(dir,root);
    const raw=fs.readFileSync(path.join(dir,'grant-private.enc.json'),'utf8');
    assert.doesNotMatch(raw,/BEGIN PRIVATE KEY/);
    assert.equal(fs.existsSync(path.join(dir,'grant-private.pem')),false);
    const second=getOrCreateSigningKeys(dir,root);
    const payload=Buffer.from('stable');
    const sig=crypto.sign(null,payload,first.privateKey);
    assert.equal(crypto.verify(null,payload,second.publicKey,sig),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('legacy plaintext signing key is migrated then removed',()=>{
  const dir=temp(),root=crypto.randomBytes(32);
  try{
    const pair=crypto.generateKeyPairSync('ed25519');
    fs.writeFileSync(path.join(dir,'grant-private.pem'),pair.privateKey.export({type:'pkcs8',format:'pem'}));
    fs.writeFileSync(path.join(dir,'grant-public.pem'),pair.publicKey.export({type:'spki',format:'pem'}));
    const keys=getOrCreateSigningKeys(dir,root);
    assert.equal(fs.existsSync(path.join(dir,'grant-private.pem')),false);
    assert.equal(keys.privateKeyStorage,'encrypted-under-platform-root');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('wrong root key cannot decrypt signing key',()=>{
  const dir=temp(),root=crypto.randomBytes(32);
  try{
    getOrCreateSigningKeys(dir,root);
    assert.throws(()=>getOrCreateSigningKeys(dir,crypto.randomBytes(32)));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
