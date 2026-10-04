import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {canonicalize, sha256} from './core.js';

const DEFAULT_KDF = Object.freeze({name:'scrypt',N:32768,r:8,p:1,keyLength:32});

function b64(value){ return Buffer.from(value).toString('base64url'); }
function unb64(value){ return Buffer.from(String(value),'base64url'); }

function assertPassphrase(passphrase){
  if (typeof passphrase !== 'string' || passphrase.length < 8) throw new Error('Context passphrase must be at least 8 characters');
}

function deriveWrappingKey(passphrase, kdf){
  if (kdf?.name !== 'scrypt') throw new Error('Unsupported context KDF');
  return crypto.scryptSync(passphrase, unb64(kdf.salt), Number(kdf.keyLength || 32), {
    N:Number(kdf.N), r:Number(kdf.r), p:Number(kdf.p), maxmem:128*1024*1024
  });
}

function sealBuffer(buffer, key, aad){
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(String(aad)));
  const ciphertext=Buffer.concat([cipher.update(buffer),cipher.final()]);
  return {iv:b64(iv),tag:b64(cipher.getAuthTag()),ciphertext:b64(ciphertext)};
}

function openBuffer(envelope, key, aad){
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,unb64(envelope.iv));
  decipher.setAAD(Buffer.from(String(aad)));
  decipher.setAuthTag(unb64(envelope.tag));
  return Buffer.concat([decipher.update(unb64(envelope.ciphertext)),decipher.final()]);
}

function sealJson(value,key,aad){ return sealBuffer(Buffer.from(JSON.stringify(value)),key,aad); }
function openJson(value,key,aad){ return JSON.parse(openBuffer(value,key,aad).toString('utf8')); }

function atomicWrite(file, value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});
  fs.renameSync(tmp,file);
  try{fs.chmodSync(file,0o600)}catch{}
}

/**
 * SealedContextStore is a ciphertext-only persistence primitive for private context.
 *
 * - A random data-encryption key (DEK) encrypts records independently with AES-256-GCM.
 * - The DEK is wrapped by a key derived from the user's passphrase using scrypt.
 * - Labels, categories, tags, privacy-domain metadata and values are inside each
 *   ciphertext; the persisted bundle exposes only opaque ids, timestamps and
 *   authenticated ciphertext.
 * - The same bundle can be synced through an untrusted server without giving that
 *   server the passphrase or plaintext context.
 *
 * This does not make an unlocked endpoint invulnerable. A compromised local process
 * can still read plaintext while the store is open, so OS isolation and keychain
 * integration remain production requirements.
 */
export class SealedContextStore {
  constructor({dir,passphrase,now=()=>Date.now()}={}){
    if(!dir) throw new Error('Context store directory is required');
    assertPassphrase(passphrase);
    this.dir=dir;
    this.file=path.join(dir,'sealed-context.json');
    this.passphrase=passphrase;
    this.now=now;
    fs.mkdirSync(dir,{recursive:true});
    if(fs.existsSync(this.file)) this.bundle=this._openExisting();
    else this.bundle=this._create();
    this.dek=this._unwrapDek(this.bundle);
  }

  _create(){
    const salt=crypto.randomBytes(16);
    const kdf={...DEFAULT_KDF,salt:b64(salt)};
    const wrappingKey=deriveWrappingKey(this.passphrase,kdf);
    const dek=crypto.randomBytes(32);
    const wrappedKey=sealBuffer(dek,wrappingKey,'supakeep/context-key/v1');
    const bundle={v:1,kdf,wrappedKey,records:[],state:null,createdAt:this.now(),updatedAt:this.now()};
    atomicWrite(this.file,bundle);
    wrappingKey.fill(0); dek.fill(0);
    return bundle;
  }

  _openExisting(){
    let bundle;
    try{bundle=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{throw new Error('Context store is unreadable');}
    if(bundle?.v!==1 || !bundle.kdf || !bundle.wrappedKey || !Array.isArray(bundle.records)) throw new Error('Unsupported or corrupt context store');
    return bundle;
  }

  _unwrapDek(bundle){
    const wrappingKey=deriveWrappingKey(this.passphrase,bundle.kdf);
    try{
      const dek=openBuffer(bundle.wrappedKey,wrappingKey,'supakeep/context-key/v1');
      if(dek.length!==32) throw new Error('Invalid data key length');
      return dek;
    } catch {
      throw new Error('Unable to unlock context store with this passphrase');
    } finally {
      wrappingKey.fill(0);
    }
  }

  _save(){
    this.bundle.updatedAt=this.now();
    atomicWrite(this.file,this.bundle);
  }

  _recordAad(id){ return `supakeep/context-record/v1/${id}`; }
  _stateAad(){ return 'supakeep/context-state/v1'; }

  _decryptRecord(record){
    const value=openJson(record.payload,this.dek,this._recordAad(record.id));
    if(value?.id!==record.id) throw new Error('Context record identity mismatch');
    return value;
  }

  records(){ return this.bundle.records.map(record=>this._decryptRecord(record)); }

  list(){
    return this.records().filter(record=>record.kind!=='internal').map(({value,...safe})=>safe);
  }

  get(id){
    const record=this.bundle.records.find(item=>item.id===String(id));
    if(!record) throw new Error('Context record not found');
    return this._decryptRecord(record);
  }

  put({id=null,kind='context',path:contextPath=null,label=null,category='general',value,tags=[],domain=undefined}={}){
    const recordId=String(id || crypto.randomUUID());
    const existing=this.bundle.records.findIndex(item=>item.id===recordId);
    const previous=existing>=0?this._decryptRecord(this.bundle.records[existing]):null;
    const createdAt=previous?.createdAt??this.now();
    const resolvedDomain=domain===undefined?structuredClone(previous?.domain??null):structuredClone(domain);
    const plain={
      v:1,id:recordId,kind:String(kind),path:contextPath==null?null:String(contextPath),label:label==null?null:String(label),
      category:String(category||'general'),value:structuredClone(value),tags:[...new Set((tags??[]).map(String))].sort(),domain:resolvedDomain,createdAt,updatedAt:this.now()
    };
    const sealed={id:recordId,updatedAt:plain.updatedAt,payload:sealJson(plain,this.dek,this._recordAad(recordId))};
    if(existing>=0) this.bundle.records[existing]=sealed; else this.bundle.records.push(sealed);
    this._save();
    const {value:_,...safe}=plain;
    return safe;
  }

  remove(id){
    const before=this.bundle.records.length;
    this.bundle.records=this.bundle.records.filter(item=>item.id!==String(id));
    if(this.bundle.records.length===before) return false;
    this._save();
    return true;
  }

  getState(){
    if(!this.bundle.state) return {};
    return openJson(this.bundle.state,this.dek,this._stateAad());
  }

  setState(state){
    this.bundle.state=sealJson(structuredClone(state??{}),this.dek,this._stateAad());
    this._save();
  }

  exportCiphertextBundle(){
    return structuredClone(this.bundle);
  }

  ciphertextFingerprint(){
    return sha256(canonicalize(this.exportCiphertextBundle()));
  }

  importCiphertextBundle(bundle){
    const candidate=structuredClone(bundle);
    if(candidate?.v!==1 || !candidate.kdf || !candidate.wrappedKey || !Array.isArray(candidate.records)) throw new Error('Unsupported ciphertext bundle');
    const candidateDek=this._unwrapDek(candidate);
    try{
      // Authenticate every record and encrypted state before replacing the store.
      for(const record of candidate.records){
        const plain=openJson(record.payload,candidateDek,this._recordAad(record.id));
        if(plain?.id!==record.id) throw new Error('Context record identity mismatch');
      }
      if(candidate.state) openJson(candidate.state,candidateDek,this._stateAad());
    } finally {
      candidateDek.fill(0);
    }
    this.bundle=candidate;
    if(this.dek) this.dek.fill(0);
    this.dek=this._unwrapDek(candidate);
    this._save();
    return {records:this.bundle.records.length,fingerprint:this.ciphertextFingerprint()};
  }
}
