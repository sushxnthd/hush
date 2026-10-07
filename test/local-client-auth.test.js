import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { LocalClientAuth, deriveLocalControlToken, deriveMcpTransportToken } from '../src/local-client-auth.js';

const root=crypto.randomBytes(32);
const req=(headers={})=>({headers});

test('control and MCP credentials are domain-separated and deterministic',()=>{
  const api=deriveLocalControlToken(root),mcp=deriveMcpTransportToken(root);
  assert.equal(api,deriveLocalControlToken(root));
  assert.equal(mcp,deriveMcpTransportToken(root));
  assert.notEqual(api,mcp);
  assert.ok(api.length>=40);
});

test('production API rejects anonymous local processes and wrong tokens',()=>{
  const auth=new LocalClientAuth({rootKey:root,required:true});
  assert.throws(()=>auth.authorizeApi(req({host:'127.0.0.1:8787'})),/authentication is required/i);
  assert.throws(()=>auth.authorizeApi(req({authorization:'Hush wrong'})),/authentication is required/i);
  assert.equal(auth.authorizeApi(req({authorization:`Hush ${deriveLocalControlToken(root)}`})).method,'control-token');
});

test('only exact configured extension origins are trusted',()=>{
  const origin='chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const auth=new LocalClientAuth({rootKey:root,required:true,allowedExtensionOrigins:[origin]});
  assert.equal(auth.authorizeApi(req({origin})).method,'trusted-extension');
  assert.throws(()=>auth.authorizeApi(req({origin:'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'})),/authentication is required/i);
  assert.throws(()=>new LocalClientAuth({rootKey:root,allowedExtensionOrigins:['chrome-extension://*']}),/Invalid trusted extension origin/);
});

test('dashboard launch is one-shot and yields an HttpOnly strict session',()=>{
  let now=1000;
  const auth=new LocalClientAuth({rootKey:root,required:true,now:()=>now,launchTtlMs:20_000,sessionTtlMs:60_000});
  const launch=auth.issueDashboardLaunch();
  const session=auth.consumeDashboardLaunch(launch.launchToken);
  assert.match(session.cookie,/HttpOnly/);
  assert.match(session.cookie,/SameSite=Strict/);
  assert.equal(auth.authorizeApi(req({cookie:`other=x; hush_session=${encodeURIComponent(session.sessionId)}`})).method,'dashboard-session');
  assert.throws(()=>auth.consumeDashboardLaunch(launch.launchToken),/invalid or expired/i);
  now+=60_001;
  assert.throws(()=>auth.authorizeApi(req({cookie:`hush_session=${session.sessionId}`})),/authentication is required/i);
});

test('MCP uses a separate transport credential and rejects the API control token',()=>{
  const auth=new LocalClientAuth({rootKey:root,required:true});
  assert.throws(()=>auth.authorizeMcp(req({authorization:`Bearer ${deriveLocalControlToken(root)}`})),/MCP transport authentication/i);
  assert.equal(auth.authorizeMcp(req({authorization:`Bearer ${deriveMcpTransportToken(root)}`})).method,'mcp-transport-token');
});

test('development bypass must be explicitly configured by caller',()=>{
  const auth=new LocalClientAuth({rootKey:root,required:false});
  assert.equal(auth.authorizeApi(req()).method,'development-bypass');
  assert.equal(auth.authorizeMcp(req()).method,'development-bypass');
});
