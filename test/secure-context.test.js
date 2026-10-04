import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SealedContextStore} from '../src/secure-context.js';

function temp(){ return fs.mkdtempSync(path.join(os.tmpdir(),'supakeep-sealed-')); }

test('private values are not present in persisted ciphertext bundle',()=>{
  const dir=temp();
  const store=new SealedContextStore({dir,passphrase:'correct horse battery staple'});
  store.put({path:'relationship.note',label:'private note',category:'relationship',value:'my parents are separating',tags:['sensitive']});
  const raw=fs.readFileSync(path.join(dir,'sealed-context.json'),'utf8');
  assert.equal(raw.includes('my parents are separating'),false);
  assert.equal(raw.includes('relationship.note'),false);
  assert.equal(raw.includes('private note'),false);
  assert.equal(raw.includes('sensitive'),false);
});

test('same passphrase reopens records and wrong passphrase fails closed',()=>{
  const dir=temp();
  const first=new SealedContextStore({dir,passphrase:'a sufficiently long passphrase'});
  first.put({path:'travel.passport',category:'identity',value:'P1234567'});
  const second=new SealedContextStore({dir,passphrase:'a sufficiently long passphrase'});
  assert.equal(second.records()[0].value,'P1234567');
  assert.throws(()=>new SealedContextStore({dir,passphrase:'definitely the wrong passphrase'}),/Unable to unlock/);
});

test('tampering with ciphertext is detected by authenticated encryption',()=>{
  const dir=temp();
  const store=new SealedContextStore({dir,passphrase:'tamper resistant passphrase'});
  store.put({path:'finance.balance',category:'finance',value:734219});
  const file=path.join(dir,'sealed-context.json');
  const bundle=JSON.parse(fs.readFileSync(file,'utf8'));
  const text=bundle.records[0].payload.ciphertext;
  bundle.records[0].payload.ciphertext=(text[0]==='A'?'B':'A')+text.slice(1);
  fs.writeFileSync(file,JSON.stringify(bundle));
  const reopened=new SealedContextStore({dir,passphrase:'tamper resistant passphrase'});
  assert.throws(()=>reopened.records());
});

test('ciphertext export contains encrypted state but no plaintext state values',()=>{
  const dir=temp();
  const store=new SealedContextStore({dir,passphrase:'sync bundle passphrase'});
  store.setState({firewallEvents:[{field:'finance.balance',spentBits:4}],profileRevision:9});
  const exported=JSON.stringify(store.exportCiphertextBundle());
  assert.equal(exported.includes('finance.balance'),false);
  assert.equal(exported.includes('spentBits'),false);
  assert.deepEqual(store.getState(),{firewallEvents:[{field:'finance.balance',spentBits:4}],profileRevision:9});
});
