import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireRuntimeLock } from '../src/runtime-lock.js';
import { assertLocalHttpRequest, parseTrustedExtensionOrigins, securityHeaders } from '../src/local-http-security.js';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'hush-lock-'));}
const trustedExtension='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

test('runtime lock prevents a second live process claim and releases cleanly',()=>{
  const dir=temp();
  try{
    const lock=acquireRuntimeLock(dir);
    assert.throws(()=>acquireRuntimeLock(dir),/already using this state directory/i);
    lock.release();
    const next=acquireRuntimeLock(dir);
    next.release();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('stale runtime lock is replaced',()=>{
  const dir=temp();
  try{
    fs.writeFileSync(path.join(dir,'runtime.lock'),JSON.stringify({pid:999999999,startedAt:0}));
    const lock=acquireRuntimeLock(dir);
    assert.equal(JSON.parse(fs.readFileSync(lock.file,'utf8')).pid,process.pid);
    lock.release();
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('loopback hosts and exact configured extension origins are accepted',()=>{
  assert.equal(assertLocalHttpRequest({headers:{host:'127.0.0.1:8787'}}),true);
  assert.equal(assertLocalHttpRequest({headers:{host:'localhost:8787',origin:trustedExtension}},{allowedExtensionOrigins:[trustedExtension]}),true);
  assert.equal(assertLocalHttpRequest({headers:{host:'[::1]:8787',origin:'http://127.0.0.1:8787'}}),true);
});

test('arbitrary extension origins, DNS rebinding and ordinary web origins are rejected',()=>{
  assert.throws(()=>assertLocalHttpRequest({headers:{host:'127.0.0.1:8787',origin:'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}},{allowedExtensionOrigins:[trustedExtension]}),/not allowed/i);
  assert.throws(()=>assertLocalHttpRequest({headers:{host:'evil.example:8787'}}),/loopback/i);
  assert.throws(()=>assertLocalHttpRequest({headers:{host:'127.0.0.1:8787',origin:'https://evil.example'}}),/not allowed/i);
});

test('trusted extension origin parser rejects wildcard or malformed origins',()=>{
  assert.deepEqual(parseTrustedExtensionOrigins(`${trustedExtension}, ${trustedExtension}`),[trustedExtension]);
  assert.throws(()=>parseTrustedExtensionOrigins('chrome-extension://*'),/Invalid trusted extension origin/);
  assert.throws(()=>parseTrustedExtensionOrigins('https://example.com'),/Invalid trusted extension origin/);
});

test('local security headers disable embedding and sensitive browser capabilities',()=>{
  const headers=securityHeaders();
  assert.equal(headers['x-frame-options'],'DENY');
  assert.match(headers['permissions-policy'],/payment=\(\)/);
  assert.equal(headers['referrer-policy'],'no-referrer');
});
