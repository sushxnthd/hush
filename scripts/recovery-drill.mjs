import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalize, sha256 } from '../src/core.js';
import { SealedContextStore } from '../src/secure-context.js';
import { createDeviceIdentity, createSyncEnvelope, DeviceTrustRegistry } from '../src/sync.js';

const startedAt=new Date().toISOString();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-recovery-drill-'));
const sourceDir=path.join(work,'source');
const recoveredDir=path.join(work,'fresh-device');
const primaryPassphrase=`primary-${crypto.randomBytes(18).toString('base64url')}`;
const recoveryPhrase=`recovery-${crypto.randomBytes(24).toString('base64url')}`;
const newPassphrase=`fresh-${crypto.randomBytes(18).toString('base64url')}`;
const sentinel=`sentinel_${crypto.randomBytes(12).toString('hex')}`;
let report;

try{
  const source=new SealedContextStore({dir:sourceDir,passphrase:primaryPassphrase});
  source.put({id:'identity-1',path:'identity.private',label:'Private identity',category:'identity',value:sentinel,tags:['critical']});
  source.put({id:'preference-1',path:'preferences.travel',label:'Travel preference',category:'preference',value:{seat:'window',budget:275},tags:['travel']});
  source.setState({profileRevision:7,revokedDevices:['device-retired'],consentRules:[{id:'c1',mode:'ask'}]});
  const expected=source.records();
  const expectedState=source.getState();
  const sourceFingerprint=source.ciphertextFingerprint();
  const kit=source.createRecoveryKit(recoveryPhrase);
  const wire=JSON.stringify(kit);
  assert.equal(kit.plaintextIncluded,false);
  assert.equal(wire.includes(sentinel),false);
  assert.equal(wire.includes('identity.private'),false);

  fs.rmSync(sourceDir,{recursive:true,force:true});
  assert.equal(fs.existsSync(sourceDir),false);
  const recovered=SealedContextStore.recoverToDirectory({dir:recoveredDir,recoveryKit:kit,recoveryPhrase,newPassphrase});
  assert.deepEqual(recovered.records(),expected);
  assert.deepEqual(recovered.getState(),expectedState);
  assert.notEqual(recovered.ciphertextFingerprint(),sourceFingerprint,'Rewrapping should change the ciphertext bundle fingerprint');
  assert.throws(()=>new SealedContextStore({dir:recoveredDir,passphrase:primaryPassphrase}),/Unable to unlock/i);

  const tampered=structuredClone(kit);
  tampered.bundle.updatedAt=Number(tampered.bundle.updatedAt)+1;
  assert.throws(()=>SealedContextStore.recoverToDirectory({dir:path.join(work,'tampered'),recoveryKit:tampered,recoveryPhrase,newPassphrase}),/fingerprint mismatch/i);
  assert.throws(()=>SealedContextStore.recoverToDirectory({dir:path.join(work,'wrong-phrase'),recoveryKit:kit,recoveryPhrase:'definitely-wrong-recovery-phrase',newPassphrase}),/Unable to recover/i);

  const oldDevice=createDeviceIdentity({label:'Old laptop'});
  const replacement=createDeviceIdentity({label:'Replacement laptop'});
  const trust=new DeviceTrustRegistry({devices:[oldDevice,replacement]});
  const envelope=createSyncEnvelope({bundle:recovered.exportCiphertextBundle(),identity:oldDevice,sequence:1});
  assert.equal(trust.verify(envelope).deviceId,oldDevice.deviceId);
  assert.equal(trust.revoke(oldDevice.deviceId),true);
  assert.throws(()=>trust.verify(envelope),/untrusted device/i);

  const contentDigest=sha256(canonicalize({records:recovered.records(),state:recovered.getState()}));
  report={
    schema:'hush.recovery-drill.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),
    plaintextInRecoveryKit:false,sourceDestroyedBeforeRecovery:true,recordsRecovered:recovered.records().length,
    stateRecovered:true,oldPassphraseRejected:true,tamperRejected:true,wrongRecoveryPhraseRejected:true,
    revokedDeviceRejected:true,contentDigest
  };
}catch(error){
  report={schema:'hush.recovery-drill.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),error:error?.message||String(error)};
  process.exitCode=1;
}finally{
  fs.rmSync(work,{recursive:true,force:true});
}

fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/recovery-drill.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
