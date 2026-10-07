import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { encryptJson, decryptJson } from './core.js';

function atomicJson(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,file);
  try{fs.chmodSync(file,0o600);}catch{}
}

export class AuthorityState {
  constructor(dir,key){
    if(!Buffer.isBuffer(key)||key.length!==32) throw new Error('AuthorityState requires a 32-byte encryption key');
    this.file=path.join(dir,'authority-state.enc.json');
    this.key=key;
    this.state=this._load();
  }
  _load(){
    if(!fs.existsSync(this.file)) return {v:1,grantUses:{},revokedGrants:[]};
    const value=decryptJson(JSON.parse(fs.readFileSync(this.file,'utf8')),this.key);
    if(value?.v!==1||!value.grantUses||!Array.isArray(value.revokedGrants)) throw new Error('Unsupported authority state');
    return value;
  }
  _save(){ atomicJson(this.file,encryptJson(this.state,this.key)); }
  useCount(grantId){ return Math.max(0,Number(this.state.grantUses[String(grantId)]||0)); }
  incrementUse(grantId){
    const id=String(grantId); const next=this.useCount(id)+1;
    this.state.grantUses[id]=next; this._save(); return next;
  }
  isRevoked(grantId){ return this.state.revokedGrants.includes(String(grantId)); }
  revoke(grantId){
    const id=String(grantId); if(!id) throw new Error('grantId is required');
    if(!this.state.revokedGrants.includes(id)){this.state.revokedGrants.push(id);this.state.revokedGrants.sort();this._save();}
    return true;
  }
  snapshot(){ return {grantUseCount:Object.keys(this.state.grantUses).length,revokedGrantCount:this.state.revokedGrants.length}; }
}
