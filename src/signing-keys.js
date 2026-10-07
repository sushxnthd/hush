import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { encryptJson, decryptJson } from './core.js';

function atomic(file,data,mode=0o600){
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const temp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd=fs.openSync(temp,'wx',mode);
  try{fs.writeFileSync(fd,data);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,file); try{fs.chmodSync(file,mode);}catch{}
}

export function getOrCreateSigningKeys(dir,rootKey){
  if(!Buffer.isBuffer(rootKey)||rootKey.length!==32) throw new Error('A 32-byte root key is required for signing-key protection');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const encryptedPrivate=path.join(dir,'grant-private.enc.json');
  const legacyPrivate=path.join(dir,'grant-private.pem');
  const publicPath=path.join(dir,'grant-public.pem');

  if(!fs.existsSync(encryptedPrivate)){
    let privatePem=null,publicPem=null;
    if(fs.existsSync(legacyPrivate)&&fs.existsSync(publicPath)){
      privatePem=fs.readFileSync(legacyPrivate,'utf8');
      publicPem=fs.readFileSync(publicPath,'utf8');
    }else{
      const pair=crypto.generateKeyPairSync('ed25519');
      privatePem=pair.privateKey.export({type:'pkcs8',format:'pem'});
      publicPem=pair.publicKey.export({type:'spki',format:'pem'});
    }
    atomic(encryptedPrivate,JSON.stringify(encryptJson({privatePem},rootKey),null,2),0o600);
    atomic(publicPath,publicPem,0o644);
    if(fs.existsSync(legacyPrivate)) fs.rmSync(legacyPrivate,{force:true});
  }

  const payload=decryptJson(JSON.parse(fs.readFileSync(encryptedPrivate,'utf8')),rootKey);
  if(typeof payload?.privatePem!=='string') throw new Error('Encrypted Hush signing key is invalid');
  const privateKey=payload.privatePem;
  const publicKey=fs.readFileSync(publicPath,'utf8');
  const probe=Buffer.from('hush-signing-key-self-test');
  const signature=crypto.sign(null,probe,privateKey);
  if(!crypto.verify(null,probe,publicKey,signature)) throw new Error('Hush signing keypair failed self-test');
  return {privateKey,publicKey,privateKeyStorage:'encrypted-under-platform-root',publicKeyPath:publicPath};
}
