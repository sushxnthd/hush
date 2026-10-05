import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SealedContextStore} from '../src/secure-context.js';
import {
  createDeviceIdentity,createSyncEnvelope,verifySyncEnvelope,DeviceTrustRegistry,
  applyCiphertextSync,SyncReplica,ciphertextBundleFingerprint
} from '../src/sync.js';

function temp(prefix='hush-sync-'){ return fs.mkdtempSync(path.join(os.tmpdir(),prefix)); }
function storeWithSecret(){
  const dir=temp();
  const store=new SealedContextStore({dir,passphrase:'primary sync passphrase'});
  store.put({path:'travel.passport',label:'Passport number',category:'identity',value:'P1234567',tags:['travel']});
  store.setState({profileRevision:3,consentRules:[{id:'consent_1',mode:'ask'}]});
  return {dir,store};
}

test('signed sync envelope binds the exact ciphertext bundle to one device identity',()=>{
  const {store}=storeWithSecret();
  const identity=createDeviceIdentity({label:'Laptop'});
  const bundle=store.exportCiphertextBundle();
  const envelope=createSyncEnvelope({bundle,identity,parentFingerprint:null,sequence:1,createdAt:1000});
  const verified=verifySyncEnvelope(envelope);
  assert.equal(verified.valid,true);
  assert.equal(verified.deviceId,identity.deviceId);
  assert.equal(verified.bundleFingerprint,ciphertextBundleFingerprint(bundle));

  const tampered=structuredClone(envelope);
  tampered.bundle.updatedAt=Number(tampered.bundle.updatedAt)+1;
  assert.throws(()=>verifySyncEnvelope(tampered),/fingerprint mismatch|invalid sync envelope signature/i);
});

test('device trust registry rejects correctly signed ciphertext from an untrusted device',()=>{
  const {store}=storeWithSecret();
  const laptop=createDeviceIdentity({label:'Laptop'});
  const phone=createDeviceIdentity({label:'Phone'});
  const trust=new DeviceTrustRegistry({devices:[laptop]});
  const remote=createSyncEnvelope({bundle:store.exportCiphertextBundle(),identity:phone,sequence:1});
  assert.throws(()=>trust.verify(remote),/untrusted device/i);
  trust.trust(phone);
  assert.equal(trust.verify(remote).deviceId,phone.deviceId);
});

test('ciphertext relay uses compare-and-swap and detects stale device overwrites',()=>{
  const {store}=storeWithSecret();
  const device=createDeviceIdentity({label:'Laptop'});
  const trust=new DeviceTrustRegistry({devices:[device]});
  const first=createSyncEnvelope({bundle:store.exportCiphertextBundle(),identity:device,parentFingerprint:null,sequence:1,createdAt:1000});
  const accepted=applyCiphertextSync({currentEnvelope:null,incomingEnvelope:first,expectedCurrentFingerprint:null,trustRegistry:trust});
  assert.equal(accepted.decision,'allow');

  const staleBundle=structuredClone(store.exportCiphertextBundle());
  staleBundle.updatedAt=Number(staleBundle.updatedAt)+10;
  const stale=createSyncEnvelope({bundle:staleBundle,identity:device,parentFingerprint:null,sequence:2,createdAt:1100});
  const conflict=applyCiphertextSync({currentEnvelope:first,incomingEnvelope:stale,expectedCurrentFingerprint:null,trustRegistry:trust});
  assert.equal(conflict.decision,'conflict');
  assert.equal(conflict.currentFingerprint,first.bundleFingerprint);
});

test('sync replica produces parent-linked uploads and recognizes identical remote state',()=>{
  const {store}=storeWithSecret();
  const identity=createDeviceIdentity({label:'Laptop'});
  const trust=new DeviceTrustRegistry({devices:[identity]});
  const replica=new SyncReplica({identity,trustRegistry:trust});
  const upload=replica.prepareUpload(store.exportCiphertextBundle(),{createdAt:1000});
  assert.equal(upload.parentFingerprint,null);
  replica.markSynced(upload);
  const next=replica.prepareUpload(store.exportCiphertextBundle(),{createdAt:1100});
  assert.equal(next.parentFingerprint,upload.bundleFingerprint);
  assert.equal(replica.inspectRemote(next,store.exportCiphertextBundle()).decision,'noop');
});

test('recovery kit contains no plaintext and can rewrap the same encrypted records under a new passphrase',()=>{
  const {store}=storeWithSecret();
  const kit=store.createRecoveryKit('separate recovery phrase');
  const wire=JSON.stringify(kit);
  assert.equal(wire.includes('P1234567'),false);
  assert.equal(wire.includes('travel.passport'),false);
  assert.equal(kit.plaintextIncluded,false);

  const recoveredDir=temp('hush-recovered-');
  const recovered=SealedContextStore.recoverToDirectory({
    dir:recoveredDir,
    recoveryKit:kit,
    recoveryPhrase:'separate recovery phrase',
    newPassphrase:'brand new local passphrase'
  });
  assert.equal(recovered.records()[0].value,'P1234567');
  assert.deepEqual(recovered.getState(),{profileRevision:3,consentRules:[{id:'consent_1',mode:'ask'}]});
  assert.throws(()=>new SealedContextStore({dir:recoveredDir,passphrase:'primary sync passphrase'}),/Unable to unlock/);
  assert.equal(new SealedContextStore({dir:recoveredDir,passphrase:'brand new local passphrase'}).records()[0].value,'P1234567');
});

test('wrong recovery phrase and tampered recovery bundle fail closed',()=>{
  const {store}=storeWithSecret();
  const kit=store.createRecoveryKit('correct recovery phrase');
  assert.throws(()=>SealedContextStore.recoverToDirectory({
    dir:temp('hush-wrong-recovery-'),recoveryKit:kit,recoveryPhrase:'wrong recovery phrase',newPassphrase:'new local passphrase'
  }),/Unable to recover/i);

  const tampered=structuredClone(kit);
  tampered.bundle.updatedAt=Number(tampered.bundle.updatedAt)+1;
  assert.throws(()=>SealedContextStore.recoverToDirectory({
    dir:temp('hush-tampered-recovery-'),recoveryKit:tampered,recoveryPhrase:'correct recovery phrase',newPassphrase:'new local passphrase'
  }),/fingerprint mismatch/i);
});
