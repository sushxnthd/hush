import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Store, getOrCreateKeys } from '../src/core.js';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'hush-core-persist-'));}

test('Store persists grant use counts and revocations encrypted across restart',()=>{
  const dir=temp();
  try{
    const first=new Store(dir);
    first.grantUses.set('grant-sensitive-id',2);
    first.revokedGrants.add('revoked-sensitive-id');
    const raw=fs.readFileSync(path.join(dir,'authority-state.enc.json'),'utf8');
    assert.doesNotMatch(raw,/grant-sensitive-id|revoked-sensitive-id/);
    const second=new Store(dir);
    assert.equal(second.grantUses.get('grant-sensitive-id'),2);
    assert.equal(second.revokedGrants.has('revoked-sensitive-id'),true);
    second.grantUses.set('grant-sensitive-id',3);
    const third=new Store(dir);
    assert.equal(third.grantUses.get('grant-sensitive-id'),3);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('getOrCreateKeys stores no plaintext private signing key and stays stable',()=>{
  const dir=temp();
  try{
    const first=getOrCreateKeys(dir);
    assert.equal(first.privateKeyStorage,'encrypted-under-platform-root');
    assert.equal(fs.existsSync(path.join(dir,'grant-private.pem')),false);
    const encrypted=fs.readFileSync(path.join(dir,'grant-private.enc.json'),'utf8');
    assert.doesNotMatch(encrypted,/BEGIN PRIVATE KEY/);
    const second=getOrCreateKeys(dir);
    const message=Buffer.from('persistent-signature');
    const signature=crypto.sign(null,message,first.privateKey);
    assert.equal(crypto.verify(null,message,second.publicKey,signature),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('legacy plaintext signing key is migrated in place without rotating identity',()=>{
  const dir=temp();
  try{
    const pair=crypto.generateKeyPairSync('ed25519');
    const oldPrivate=pair.privateKey.export({type:'pkcs8',format:'pem'});
    const oldPublic=pair.publicKey.export({type:'spki',format:'pem'});
    fs.writeFileSync(path.join(dir,'grant-private.pem'),oldPrivate,{mode:0o600});
    fs.writeFileSync(path.join(dir,'grant-public.pem'),oldPublic,{mode:0o644});
    const migrated=getOrCreateKeys(dir);
    assert.equal(fs.existsSync(path.join(dir,'grant-private.pem')),false);
    assert.equal(migrated.publicKey,oldPublic);
    const payload=Buffer.from('identity-preserved');
    assert.equal(crypto.verify(null,payload,oldPublic,crypto.sign(null,payload,migrated.privateKey)),true);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
