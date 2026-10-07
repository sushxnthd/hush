import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { getOrCreatePlatformRootKey, deriveContextPassphrase } from '../src/platform-key-store.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'hush-key-')); }

test('development fallback creates a stable 32-byte root key with restricted file permissions where supported',()=>{
  const dir=temp();
  try{
    const a=getOrCreatePlatformRootKey(dir,{production:false,allowFileFallback:true});
    const b=getOrCreatePlatformRootKey(dir,{production:false,allowFileFallback:true});
    assert.equal(a.key.length,32);
    assert.equal(b.key.length,32);
    assert.deepEqual(a.key,b.key);
    assert.ok(['restricted-file','windows-dpapi','macos-keychain','linux-secret-service'].includes(a.backend));
    if(a.backend==='restricted-file'&&process.platform!=='win32'){
      const mode=fs.statSync(path.join(dir,'master.key')).mode&0o777;
      assert.equal(mode,0o600);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('context passphrase is deterministic domain-separated key material',()=>{
  const key=crypto.randomBytes(32);
  const first=deriveContextPassphrase(key);
  const second=deriveContextPassphrase(key);
  assert.equal(first,second);
  assert.ok(first.length>=43);
  assert.notEqual(first,key.toString('base64url'));
  assert.notEqual(first,deriveContextPassphrase(crypto.randomBytes(32)));
});

test('production file fallback is only allowed when explicitly opted in',()=>{
  const dir=temp();
  try{
    if(process.platform==='linux'){
      try{
        const result=getOrCreatePlatformRootKey(dir,{production:true,allowFileFallback:false});
        assert.notEqual(result.backend,'restricted-file');
      }catch(error){
        assert.match(error.message,/credential store|secret service|root key/i);
      }
    }
    const allowed=getOrCreatePlatformRootKey(dir,{production:true,allowFileFallback:true});
    assert.equal(allowed.key.length,32);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
