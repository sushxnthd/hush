import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Vault, Store, createReceipt, verifyReceiptChain } from '../src/core.js';
import { SealedContextStore } from '../src/secure-context.js';

const durationMs=Math.max(1000,Number(process.env.HUSH_SOAK_DURATION_MS||30000));
const maxIterations=Math.max(1,Number(process.env.HUSH_SOAK_MAX_ITERATIONS||1000000));
const started=Date.now();
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hush-soak-'));
const contextDir=path.join(root,'context');
const vaultDir=path.join(root,'vault');
const storeDir=path.join(root,'store');
const vaultKey=crypto.randomBytes(32);
const passphrase=`soak-${crypto.randomBytes(24).toString('base64url')}`;
let iterations=0,writes=0,reopens=0;
let failure=null;

try{
  while(iterations<maxIterations&&Date.now()-started<durationMs){
    iterations++;
    {
      const context=new SealedContextStore({dir:contextDir,passphrase});
      context.put({id:`record-${iterations%17}`,path:`synthetic.${iterations%17}`,label:'Soak record',category:'general',value:{iteration:iterations,nonce:crypto.randomBytes(8).toString('hex')}});
      context.setState({iteration:iterations,lastStable:true});
      writes+=2;
    }
    {
      const vault=new Vault(vaultDir,vaultKey);
      const item=vault.put({label:`soak-${iterations}`,type:'secret',value:`secret-${iterations}-${crypto.randomBytes(6).toString('hex')}`});
      assert.equal(vault.list().some(x=>x.id===item.id),true);
      if(vault.list().length>25) vault.remove(vault.list()[0].id);
      writes++;
    }
    {
      const store=new Store(storeDir);
      store.grantUses.set('persistent-grant',iterations);
      if(iterations%7===0) store.revokedGrants.add(`revoked-${iterations}`);
      const receipt=createReceipt({previousHash:store.receipts.at(-1)?.hash??null,request:{agent:'soak',action:'write',resource:'durability',iteration:iterations},decision:'allow',result:{iteration:iterations}});
      store.addReceipt(receipt);
      assert.equal(verifyReceiptChain(store.receipts),true);
      writes+=2;
    }

    const reopenedContext=new SealedContextStore({dir:contextDir,passphrase});
    assert.equal(reopenedContext.getState().iteration,iterations);
    const reopenedVault=new Vault(vaultDir,vaultKey);
    assert.ok(reopenedVault.list().length>0);
    const reopenedStore=new Store(storeDir);
    assert.equal(reopenedStore.grantUses.get('persistent-grant'),iterations);
    assert.equal(verifyReceiptChain(reopenedStore.receipts),true);
    reopens+=3;
  }
}catch(error){ failure=error; process.exitCode=1; }

const elapsedMs=Date.now()-started;
const report={
  schema:'hush.durability-soak.v1',status:failure?'fail':'pass',startedAt:new Date(started).toISOString(),completedAt:new Date().toISOString(),
  requestedDurationMs:durationMs,elapsedMs,iterations,writes,reopens,operationsPerSecond:elapsedMs?Math.round(((writes+reopens)/(elapsedMs/1000))*100)/100:null,
  failure:failure?failure.message:null
};
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/soak.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
fs.rmSync(root,{recursive:true,force:true});
