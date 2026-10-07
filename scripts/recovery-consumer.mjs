import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalize,sha256} from '../src/core.js';
import {SealedContextStore} from '../src/secure-context.js';

const dir=path.resolve(process.env.HUSH_RECOVERY_FIXTURE_DIR||'dist/cross-machine-recovery');
const fixture=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json'),'utf8'));
const work=fs.mkdtempSync(path.join(os.tmpdir(),'hush-recovery-consumer-'));
let report;
try{
  assert.equal(fixture.schema,'hush.cross-machine-recovery-fixture.v1');
  const recoveredDir=path.join(work,'recovered');
  const newPassphrase=`consumer-${crypto.randomBytes(24).toString('base64url')}`;
  const recovered=SealedContextStore.recoverToDirectory({dir:recoveredDir,recoveryKit:fixture.recoveryKit,recoveryPhrase:fixture.recoveryPhrase,newPassphrase});
  const digest=sha256(canonicalize({records:recovered.records(),state:recovered.getState()}));
  assert.equal(digest,fixture.expectedDigest);
  assert.throws(()=>SealedContextStore.recoverToDirectory({dir:path.join(work,'wrong'),recoveryKit:fixture.recoveryKit,recoveryPhrase:'wrong-phrase',newPassphrase}),/Unable to recover/i);
  const tampered=structuredClone(fixture.recoveryKit);
  tampered.bundle.updatedAt=Number(tampered.bundle.updatedAt)+1;
  assert.throws(()=>SealedContextStore.recoverToDirectory({dir:path.join(work,'tampered'),recoveryKit:tampered,recoveryPhrase:fixture.recoveryPhrase,newPassphrase}),/fingerprint mismatch/i);
  report={schema:'hush.cross-machine-recovery-consumer.v1',status:'pass',platform:process.platform,arch:process.arch,completedAt:new Date().toISOString(),expectedDigest:fixture.expectedDigest,recoveredDigest:digest,wrongPhraseRejected:true,tamperRejected:true};
}catch(error){report={schema:'hush.cross-machine-recovery-consumer.v1',status:'fail',platform:process.platform,arch:process.arch,completedAt:new Date().toISOString(),error:error?.message||String(error)};process.exitCode=1;}
finally{fs.rmSync(work,{recursive:true,force:true});}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync(`dist/evidence/cross-machine-recovery-${process.platform}.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
