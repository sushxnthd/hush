import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalize,sha256} from '../src/core.js';
import {SealedContextStore} from '../src/secure-context.js';

const out=path.resolve(process.env.HUSH_RECOVERY_FIXTURE_DIR||'dist/cross-machine-recovery');
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-recovery-producer-'));
try{
  const source=path.join(work,'source');
  const passphrase=`source-${crypto.randomBytes(24).toString('base64url')}`;
  const recoveryPhrase=`recover-${crypto.randomBytes(32).toString('base64url')}`;
  const sentinel=`private_${crypto.randomBytes(20).toString('hex')}`;
  const store=new SealedContextStore({dir:source,passphrase});
  store.put({id:'identity',path:'identity.private',label:'Private identity',category:'identity',value:sentinel,tags:['critical']});
  store.put({id:'travel',path:'preferences.travel',label:'Travel',category:'preference',value:{seat:'window',budget:275},tags:['travel']});
  store.setState({profileRevision:11,consentRules:[{id:'rule-1',mode:'ask'}],revokedDevices:['device-old']});
  const expectedDigest=sha256(canonicalize({records:store.records(),state:store.getState()}));
  const recoveryKit=store.createRecoveryKit(recoveryPhrase);
  const wire=JSON.stringify(recoveryKit);
  assert.equal(recoveryKit.plaintextIncluded,false);
  assert.equal(wire.includes(sentinel),false);
  assert.equal(wire.includes('identity.private'),false);
  fs.rmSync(source,{recursive:true,force:true});
  fs.rmSync(out,{recursive:true,force:true});
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'fixture.json'),JSON.stringify({schema:'hush.cross-machine-recovery-fixture.v1',recoveryKit,recoveryPhrase,expectedDigest},null,2)+'\n',{mode:0o600});
  fs.writeFileSync(path.join(out,'producer-evidence.json'),JSON.stringify({schema:'hush.cross-machine-recovery-producer.v1',status:'pass',createdAt:new Date().toISOString(),sourceDestroyed:true,plaintextInRecoveryKit:false,expectedDigest},null,2)+'\n');
  console.log(JSON.stringify({status:'pass',expectedDigest,output:out},null,2));
}finally{fs.rmSync(work,{recursive:true,force:true});}
