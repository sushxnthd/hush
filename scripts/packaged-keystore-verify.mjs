import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const startedAt=new Date().toISOString();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-packaged-keystore-'));
let report;
try{
  const summary=JSON.parse(fs.readFileSync('dist/release-summary.json','utf8'));
  const bundle=path.resolve(summary.bundle);
  const moduleUrl=pathToFileURL(path.join(bundle,'src','platform-key-store.js')).href;
  const {getOrCreatePlatformRootKey,deriveContextPassphrase}=await import(moduleUrl);
  const dataDir=path.join(work,'state');
  const first=getOrCreatePlatformRootKey(dataDir,{production:true,allowFileFallback:false});
  const second=getOrCreatePlatformRootKey(dataDir,{production:true,allowFileFallback:false});
  const expected=process.platform==='win32'?'windows-dpapi':process.platform==='darwin'?'macos-keychain':null;
  if(!expected) throw new Error(`Packaged keystore verification is only defined for Windows/macOS here; got ${process.platform}`);
  assert.equal(first.backend,expected);
  assert.equal(second.backend,expected);
  assert.equal(crypto.timingSafeEqual(first.key,second.key),true,'OS credential store must return the stable root key');
  assert.equal(fs.existsSync(path.join(dataDir,'master.key')),false,'Production packaged build must not create plaintext master.key');
  const passphrase=deriveContextPassphrase(first.key);
  assert.ok(typeof passphrase==='string'&&passphrase.length>=32);
  report={schema:'hush.packaged-keystore.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,backend:first.backend,stableAcrossReopen:true,plaintextFallbackAbsent:true,contextSecretDerivation:true,releaseVersion:summary.version,releaseCommit:summary.commit};
}catch(error){report={schema:'hush.packaged-keystore.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),platform:process.platform,arch:process.arch,error:error?.message||String(error)};process.exitCode=1;}
finally{fs.rmSync(work,{recursive:true,force:true});}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync(`dist/evidence/packaged-keystore-${process.platform}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
