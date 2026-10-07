import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acquireRuntimeLock } from '../src/runtime-lock.js';
import { LocalClientAuth, deriveLocalControlToken, deriveMcpTransportToken } from '../src/local-client-auth.js';
import { assertLocalHttpRequest, parseTrustedExtensionOrigins, securityHeaders } from '../src/local-http-security.js';

function temp(){return fs.mkdtempSync(path.join(os.tmpdir(),'hush-lock-'));}
const trustedExtension='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const rootKey=crypto.randomBytes(32);
const auth=new LocalClientAuth({rootKey,required:true,allowedExtensionOrigins:[trustedExtension]});
const request=(url,headers={})=>({url,headers:{host:'127.0.0.1:8787',...headers}});

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

test('loopback same-origin and exact configured extension origins are accepted',()=>{
  assert.equal(assertLocalHttpRequest({url:'/',headers:{host:'127.0.0.1:8787'}}),true);
  assert.equal(assertLocalHttpRequest(request('/api/status',{origin:trustedExtension}),{allowedExtensionOrigins:[trustedExtension],auth}),true);
  assert.equal(assertLocalHttpRequest({url:'/',headers:{host:'[::1]:8787',origin:'http://[::1]:8787'}}),true);
  assert.equal(assertLocalHttpRequest(request('/',{origin:'http://127.0.0.1:8787'})),true);
});

test('cross-port loopback, arbitrary extensions, DNS rebinding and web origins are rejected',()=>{
  assert.throws(()=>assertLocalHttpRequest(request('/',{origin:'http://127.0.0.1:9999'})),/not allowed/i);
  assert.throws(()=>assertLocalHttpRequest(request('/api/status',{origin:'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}),{allowedExtensionOrigins:[trustedExtension],auth}),/not allowed/i);
  assert.throws(()=>assertLocalHttpRequest({url:'/',headers:{host:'evil.example:8787'}}),/loopback/i);
  assert.throws(()=>assertLocalHttpRequest({url:'/',headers:{host:'127.0.0.1:8787',origin:'https://evil.example'}}),/not allowed/i);
});

test('sensitive API routes require local client auth but static files remain public',()=>{
  assert.equal(assertLocalHttpRequest(request('/'),{auth}),true);
  assert.throws(()=>assertLocalHttpRequest(request('/api/status'),{auth}),/authentication is required/i);
  assert.equal(assertLocalHttpRequest(request('/api/status',{authorization:`Hush ${deriveLocalControlToken(rootKey)}`}),{auth}),true);
});

test('dashboard bootstrap tokens are one-shot and sessions authorize protected API calls',()=>{
  let now=10_000;
  const isolated=new LocalClientAuth({rootKey:crypto.randomBytes(32),required:true,now:()=>now,launchTtlMs:10_000,sessionTtlMs:60_000});
  const launch=isolated.issueDashboardLaunch();
  assert.match(launch.path,/^\/dashboard\/bootstrap\//);
  const session=isolated.consumeDashboardLaunch(launch.launchToken);
  assert.match(session.cookie,/HttpOnly/);
  assert.match(session.cookie,/SameSite=Strict/);
  assert.throws(()=>isolated.consumeDashboardLaunch(launch.launchToken),/invalid or expired/i);
  assert.equal(isolated.authorizeApi(request('/api/status',{cookie:`hush_session=${encodeURIComponent(session.sessionId)}`})).authorized,true);
  now=session.expiresAt;
  assert.throws(()=>isolated.authorizeApi(request('/api/status',{cookie:`hush_session=${encodeURIComponent(session.sessionId)}`})),/authentication is required/i);
});

test('OAuth callback stays state-PKCE reachable while other onboarding APIs require auth',()=>{
  assert.equal(assertLocalHttpRequest(request('/api/onboarding/callback/google?state=x&code=y'),{auth}),true);
  assert.throws(()=>assertLocalHttpRequest(request('/api/onboarding/google/start'),{auth}),/authentication is required/i);
});

test('MCP uses separate transport auth and rejects the API control token',()=>{
  assert.throws(()=>assertLocalHttpRequest(request('/mcp',{authorization:`Bearer ${deriveLocalControlToken(rootKey)}`}),{auth}),/MCP transport authentication/i);
  assert.equal(assertLocalHttpRequest(request('/mcp',{authorization:`Bearer ${deriveMcpTransportToken(rootKey)}`}),{auth}),true);
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
