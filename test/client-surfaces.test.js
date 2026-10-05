import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('browser extension requests only loopback host access and no page-wide content permissions',()=>{
  const manifest=JSON.parse(read('clients/browser/manifest.json'));
  assert.equal(manifest.manifest_version,3);
  assert.deepEqual(manifest.permissions,['storage']);
  assert.equal(manifest.host_permissions.includes('<all_urls>'),false);
  assert.equal(manifest.host_permissions.every(pattern=>/^http:\/\/(?:127\.0\.0\.1|localhost):8787\/\*$/.test(pattern)),true);
  assert.equal('content_scripts' in manifest,false);
  assert.equal('background' in manifest,false);
});

test('browser companion has approval and redaction UX without raw vault access',()=>{
  const client=read('clients/browser/hush-client.js');
  const popup=read('clients/browser/popup.js');
  assert.match(client,/\/api\/pending/);
  assert.match(client,/\/api\/redact/);
  assert.doesNotMatch(client,/\/api\/vault/);
  assert.doesNotMatch(client,/\/api\/context(?:['"`/])/);
  assert.doesNotMatch(popup,/innerHTML\s*=\s*[^;]*\.redacted/);
});

test('mobile alpha shell is explicitly same-device only',()=>{
  const mobile=read('clients/mobile/mobile.js');
  const html=read('clients/mobile/index.html');
  assert.match(mobile,/127\.0\.0\.1:8787/);
  assert.doesNotMatch(mobile,/localStorage|sessionStorage/);
  assert.match(html,/same device/i);
  assert.match(html,/Remote network access is not enabled/i);
});

test('desktop companion delegates networking to loopback-safe shared SDK',()=>{
  const desktop=read('clients/desktop/hush-desktop.mjs');
  assert.match(desktop,/HushClient/);
  assert.match(desktop,/\.\.\/\.\.\/src\/client-sdk\.js/);
  assert.doesNotMatch(desktop,/allowRemote\s*:\s*true/);
});
