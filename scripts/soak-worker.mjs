// Test-only process: filesystem hooks never enter the shipped runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {Vault,Store,createReceipt,getOrCreateKeys} from '../src/core.js';
import {SealedContextStore} from '../src/secure-context.js';
import {signReceipt,verifySignedReceiptChain} from '../src/receipt-security.js';

const root=process.argv[2];
const fixture=JSON.parse(fs.readFileSync(path.join(root,'fixture.json'),'utf8'));
assert.equal(fixture.schema,'hush.synthetic-soak-fixture.v1');
const context=new SealedContextStore({dir:path.join(root,'context'),passphrase:fixture.passphrase});
const vault=new Vault(path.join(root,'vault'),Buffer.from(fixture.vaultKey,'hex'));
const store=new Store(path.join(root,'store'));
const keys=getOrCreateKeys(path.join(root,'store'));
function receipt(){
  store.addReceipt(signReceipt(createReceipt({previousHash:store.receipts.at(-1)?.hash??null,
    request:{agent:'synthetic-soak',action:'write',resource:'durability',sequence:store.receipts.length},
    decision:'allow',result:{synthetic:true}}),keys.privateKey));
}
if(!fs.existsSync(path.join(root,'initialized'))){
  context.put({id:'baseline',value:'synthetic-context-canary'});
  context.setState({version:0});
  vault.put({label:'baseline',value:'synthetic-vault-canary'});
  store.revokedGrants.add('revoked-sentinel');
  store.grantUses.set('durability-grant',0);
  receipt();
  fs.writeFileSync(path.join(root,'initialized'),'synthetic fixture initialized\n');
}
function snapshot(){
  assert.equal(context.get('baseline').value,'synthetic-context-canary');
  assert.equal(vault.resolve(vault.list().find(x=>x.label==='baseline')?.id),'synthetic-vault-canary');
  assert.equal(store.revokedGrants.has('revoked-sentinel'),true);
  const chain=verifySignedReceiptChain(store.receipts,keys.publicKey,{allowLegacyPrefix:false});
  assert.equal(chain.valid,true); assert.equal(chain.anchored,true);
  return {context:context.getState().version,vault:Math.max(0,...vault.list().map(x=>Number(x.label.slice(8))||0)),
    authority:store.grantUses.get('durability-grant'),receipts:store.receipts.length,receiptHead:store.receipts.at(-1).hash};
}

let fault=null;
const descriptors=new Map();
const original={openSync:fs.openSync,closeSync:fs.closeSync,writeFileSync:fs.writeFileSync,fsyncSync:fs.fsyncSync,renameSync:fs.renameSync};
function boundary(phase,file){
  if(!fault||fault.phase!==phase||typeof file!=='string') return;
  const base=path.basename(file);
  if(base!==fault.file&&!(base.startsWith(fault.file+'.')&&base.endsWith('.tmp'))) return;
  process.send({type:'fault',fault});
  // Remain exactly at this boundary until the parent kills this process.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30000);
  throw new Error('Parent did not kill the faulted process');
}
fs.openSync=function(file,...args){const fd=original.openSync.call(fs,file,...args);descriptors.set(fd,String(file));return fd;};
fs.closeSync=function(fd){descriptors.delete(fd);return original.closeSync.call(fs,fd);};
fs.writeFileSync=function(file,...args){const target=typeof file==='number'?descriptors.get(file):String(file);
  boundary('before-write',target);const result=original.writeFileSync.call(fs,file,...args);boundary('after-write',target);return result;};
fs.fsyncSync=function(fd){const result=original.fsyncSync.call(fs,fd);boundary('after-file-fsync',descriptors.get(fd));return result;};
fs.renameSync=function(from,to){boundary('before-rename',String(to));const result=original.renameSync.call(fs,from,to);boundary('after-rename',String(to));return result;};
process.on('message',message=>{
  try{
    if(message.type==='stop'){process.disconnect();return;}
    assert.equal(message.type,'cycle');
    fault=message.fault??null;
    context.setState({version:context.getState().version+1});
    const version=Math.max(0,...vault.list().map(x=>Number(x.label.slice(8))||0))+1;
    vault.put({label:`version-${version}`,value:`synthetic-secret-${version}`});
    for(const item of vault.list().filter(x=>x.label!=='baseline').slice(0,-24)) vault.remove(item.id);
    store.grantUses.set('durability-grant',store.grantUses.get('durability-grant')+1);
    receipt();
    fault=null; process.send({type:'committed',snapshot:snapshot()});
  }catch(error){process.send({type:'error',message:error.message});process.exitCode=1;process.disconnect();}
});
process.send({type:'ready',snapshot:snapshot()});
