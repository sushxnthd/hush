import crypto from 'node:crypto';
import {canonicalize,sha256} from './core.js';

function clone(value){ return structuredClone(value); }
function b64(value){ return Buffer.from(value).toString('base64url'); }
function text(value,max=240){
  const out=String(value??'').trim();
  if(!out) throw new Error('Sync text value is required');
  if(out.length>max) throw new Error(`Sync text values must be at most ${max} characters`);
  return out;
}
function publicKeyPem(key){
  return typeof key==='string'?key:key.export({type:'spki',format:'pem'}).toString();
}
function privateKeyPem(key){
  return typeof key==='string'?key:key.export({type:'pkcs8',format:'pem'}).toString();
}

export function ciphertextBundleFingerprint(bundle){
  return sha256(canonicalize(bundle));
}

export function createDeviceIdentity({label='Hush device'}={}){
  const pair=crypto.generateKeyPairSync('ed25519');
  const publicKey=publicKeyPem(pair.publicKey);
  const privateKey=privateKeyPem(pair.privateKey);
  return {
    deviceId:`device_${sha256(publicKey).slice(0,32)}`,
    label:text(label,120),
    publicKey,
    privateKey
  };
}

function envelopeBody({bundle,deviceId,label,publicKey,parentFingerprint=null,sequence=1,createdAt=Date.now()}={}){
  if(!bundle||typeof bundle!=='object') throw new Error('Ciphertext bundle is required');
  const seq=Number(sequence);
  if(!Number.isSafeInteger(seq)||seq<1) throw new Error('Sync sequence must be a positive safe integer');
  const at=Number(createdAt);
  if(!Number.isFinite(at)||at<=0) throw new Error('Sync createdAt must be a positive timestamp');
  const pem=publicKeyPem(publicKey);
  const derivedId=`device_${sha256(pem).slice(0,32)}`;
  if(String(deviceId)!==derivedId) throw new Error('Device id does not match its public key');
  return {
    v:1,
    deviceId:derivedId,
    deviceLabel:text(label||'Hush device',120),
    publicKey:pem,
    sequence:seq,
    parentFingerprint:parentFingerprint==null?null:String(parentFingerprint),
    bundleFingerprint:ciphertextBundleFingerprint(bundle),
    createdAt:at,
    bundle:clone(bundle)
  };
}

export function createSyncEnvelope({bundle,identity,parentFingerprint=null,sequence=1,createdAt=Date.now()}={}){
  if(!identity?.deviceId||!identity?.publicKey||!identity?.privateKey) throw new Error('Complete device identity is required');
  const body=envelopeBody({
    bundle,
    deviceId:identity.deviceId,
    label:identity.label,
    publicKey:identity.publicKey,
    parentFingerprint,
    sequence,
    createdAt
  });
  const signature=crypto.sign(null,Buffer.from(canonicalize(body)),identity.privateKey);
  return {...body,signature:b64(signature)};
}

export function verifySyncEnvelope(envelope){
  if(envelope?.v!==1||!envelope.signature) throw new Error('Unsupported sync envelope');
  const {signature,...rawBody}=clone(envelope);
  const body=envelopeBody({
    bundle:rawBody.bundle,
    deviceId:rawBody.deviceId,
    label:rawBody.deviceLabel,
    publicKey:rawBody.publicKey,
    parentFingerprint:rawBody.parentFingerprint,
    sequence:rawBody.sequence,
    createdAt:rawBody.createdAt
  });
  if(body.bundleFingerprint!==rawBody.bundleFingerprint) throw new Error('Sync bundle fingerprint mismatch');
  const valid=crypto.verify(null,Buffer.from(canonicalize(body)),body.publicKey,Buffer.from(String(signature),'base64url'));
  if(!valid) throw new Error('Invalid sync envelope signature');
  return {valid:true,deviceId:body.deviceId,bundleFingerprint:body.bundleFingerprint,parentFingerprint:body.parentFingerprint,sequence:body.sequence,createdAt:body.createdAt};
}

export class DeviceTrustRegistry {
  constructor({devices=[]}={}){
    this.devices=new Map();
    for(const device of devices) this.trust(device);
  }
  trust({deviceId,publicKey,label='Hush device'}={}){
    const pem=publicKeyPem(publicKey);
    const derivedId=`device_${sha256(pem).slice(0,32)}`;
    if(String(deviceId)!==derivedId) throw new Error('Trusted device id does not match its public key');
    const row={deviceId:derivedId,publicKey:pem,label:text(label,120),trustedAt:Date.now()};
    this.devices.set(derivedId,row);
    return clone(row);
  }
  revoke(deviceId){ return this.devices.delete(String(deviceId)); }
  get(deviceId){ const row=this.devices.get(String(deviceId)); return row?clone(row):null; }
  list(){ return [...this.devices.values()].map(clone).sort((a,b)=>a.deviceId.localeCompare(b.deviceId)); }
  verify(envelope){
    const verified=verifySyncEnvelope(envelope);
    const trusted=this.devices.get(verified.deviceId);
    if(!trusted) throw new Error('Sync envelope came from an untrusted device');
    if(trusted.publicKey!==envelope.publicKey) throw new Error('Trusted device key mismatch');
    return verified;
  }
}

/**
 * Compare-and-swap relay semantics for ciphertext-only synchronization. The relay
 * never decrypts context. A stale device cannot silently overwrite a newer remote
 * snapshot: it must first fetch and reconcile the new encrypted snapshot locally.
 */
export function applyCiphertextSync({currentEnvelope=null,incomingEnvelope,expectedCurrentFingerprint=null,trustRegistry=null}={}){
  const incoming=trustRegistry?trustRegistry.verify(incomingEnvelope):verifySyncEnvelope(incomingEnvelope);
  let current=null;
  if(currentEnvelope) current=trustRegistry?trustRegistry.verify(currentEnvelope):verifySyncEnvelope(currentEnvelope);
  const currentFingerprint=current?.bundleFingerprint??null;
  const expected=expectedCurrentFingerprint==null?null:String(expectedCurrentFingerprint);
  if(currentFingerprint!==expected){
    return {decision:'conflict',reason:'Remote ciphertext changed since this device last synchronized.',currentFingerprint,incomingFingerprint:incoming.bundleFingerprint};
  }
  if(incoming.parentFingerprint!==expected){
    return {decision:'conflict',reason:'Incoming sync envelope was not based on the expected remote ciphertext.',currentFingerprint,incomingFingerprint:incoming.bundleFingerprint};
  }
  if(current&&incoming.deviceId===current.deviceId&&incoming.sequence<=current.sequence){
    return {decision:'deny',reason:'Sync sequence did not advance for this device.',currentFingerprint,incomingFingerprint:incoming.bundleFingerprint};
  }
  return {decision:'allow',envelope:clone(incomingEnvelope),currentFingerprint:incoming.bundleFingerprint};
}

export class SyncReplica {
  constructor({identity,trustRegistry=new DeviceTrustRegistry(),lastSyncedFingerprint=null,sequence=0}={}){
    if(!identity?.deviceId||!identity?.publicKey||!identity?.privateKey) throw new Error('SyncReplica requires a device identity');
    this.identity=clone(identity);
    this.trustRegistry=trustRegistry;
    if(!this.trustRegistry.get(identity.deviceId)) this.trustRegistry.trust(identity);
    this.lastSyncedFingerprint=lastSyncedFingerprint==null?null:String(lastSyncedFingerprint);
    this.sequence=Number(sequence)||0;
  }
  prepareUpload(bundle,{createdAt=Date.now()}={}){
    this.sequence+=1;
    return createSyncEnvelope({bundle,identity:this.identity,parentFingerprint:this.lastSyncedFingerprint,sequence:this.sequence,createdAt});
  }
  markSynced(envelope){
    const verified=this.trustRegistry.verify(envelope);
    this.lastSyncedFingerprint=verified.bundleFingerprint;
    return verified;
  }
  inspectRemote(envelope,currentBundle){
    const verified=this.trustRegistry.verify(envelope);
    const localFingerprint=ciphertextBundleFingerprint(currentBundle);
    if(verified.bundleFingerprint===localFingerprint) return {decision:'noop',verified};
    if(this.lastSyncedFingerprint!==verified.parentFingerprint&&this.lastSyncedFingerprint!==verified.bundleFingerprint){
      return {decision:'conflict',reason:'Local and remote ciphertext histories diverged.',verified,localFingerprint};
    }
    return {decision:'import',verified,localFingerprint,bundle:clone(envelope.bundle)};
  }
}
