import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateReleaseEvidence,unchangedEvidenceSource} from '../src/release-evidence.js';
const now=Date.parse('2026-10-08T12:00:00Z');
const valid=()=>({schema:'hush.release-evidence.v2',status:'pass',issuedAt:'2026-10-08T11:00:00Z',commit:'a'.repeat(40),scope:'Packaged synthetic fixture',limitations:'Unsigned candidate; no independent assurance',evidence:'Completed workflow and retained report',evidenceUrls:['https://github.com/acme/hush/actions/runs/1'],artifacts:[{name:'candidate-linux',digest:'sha256:'+'b'.repeat(64),url:'https://github.com/acme/hush/actions/runs/1'}],reviewer:{name:'Reviewer',organization:'Independent lab',independent:true}});
const check=(v,options={})=>validateReleaseEvidence(v,{now,paths:['src'],verifySource:()=>true,...options});
test('release evidence requires scope, limitations, exact commit and checkable source',()=>{
  assert.equal(check(valid()).pass,true);
  for(const field of ['schema','commit','scope','limitations','evidenceUrls','issuedAt']){const v=valid();delete v[field];assert.equal(check(v).pass,false,field);}
  assert.equal(check(valid(),{verifySource:()=>false}).pass,false);
});
test('future, placeholder, expired and unbound artifact evidence is rejected',()=>{
  const v=valid();v.issuedAt='2027-01-01T00:00:00Z';assert.equal(check(v).pass,false);
  v.issuedAt=valid().issuedAt;v.evidenceUrls=['https://example.com/report'];assert.equal(check(v).pass,false);
  v.evidenceUrls=valid().evidenceUrls;v.artifacts[0].expiresAt='2026-10-08T10:00:00Z';assert.equal(check(v,{requireArtifacts:true}).pass,false);
  delete v.artifacts[0].expiresAt;delete v.artifacts[0].digest;assert.equal(check(v,{requireArtifacts:true}).pass,false);
});
test('independent assurance requires reviewer identity and explicit independence',()=>{
  assert.equal(check(valid(),{requireIndependent:true}).pass,true);
  const v=valid();v.reviewer.independent=false;assert.equal(check(v,{requireIndependent:true}).pass,false);
  delete v.reviewer;assert.equal(check(v,{requireIndependent:true}).pass,false);
});
test('soak cannot pass from short smoke coverage or forged full-run flag alone',()=>{
  const v=valid();v.validation={schema:'hush.durability-soak.v2',commit:v.commit,status:'pass',cumulativeActiveMs:60_000,wallMs:60_000,totalCrashes:20,coverageComplete:true,full72HourSatisfied:true};
  assert.equal(check(v,{requirement:'reliability-soak'}).pass,false);
  v.validation.cumulativeActiveMs=259_200_000;v.validation.wallMs=259_200_000;assert.equal(check(v,{requirement:'reliability-soak'}).pass,true);
  v.validation.commit='c'.repeat(40);assert.equal(check(v,{requirement:'reliability-soak'}).pass,false);
});
test('signed distribution and packaged keystore need explicit platform results',()=>{
  const v=valid();assert.equal(check(v,{requirement:'distribution-signing'}).pass,false);
  v.validation={signedPlatforms:['win32','darwin'],macNotarizationVerified:true,artifactSignaturesVerified:true};assert.equal(check(v,{requirement:'distribution-signing'}).pass,true);
  v.validation={backends:{win32:'windows-dpapi',darwin:'macos-keychain',linux:'restricted-file'},noPlaintextFallback:true};assert.equal(check(v,{requirement:'platform-keystore'}).pass,false);
  v.validation.backends.linux='linux-secret-service';assert.equal(check(v,{requirement:'platform-keystore'}).pass,true);
});
test('historical evidence cannot certify changed, dirty or untracked runtime source',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hush-evidence-'));
  const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  try{
    git(['init']);git(['config','user.name','Test']);git(['config','user.email','test@example.invalid']);
    fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','kernel.js'),'original');git(['add','.']);git(['commit','-m','fixture']);const commit=git(['rev-parse','HEAD']);
    assert.equal(unchangedEvidenceSource({root,commit,paths:['src']}),true);
    fs.writeFileSync(path.join(root,'README.md'),'unrelated docs');
    assert.equal(unchangedEvidenceSource({root,commit,paths:['src']}),true);
    fs.writeFileSync(path.join(root,'src','new.js'),'new code');assert.equal(unchangedEvidenceSource({root,commit,paths:['src']}),false);
    fs.rmSync(path.join(root,'src','new.js'));fs.writeFileSync(path.join(root,'src','kernel.js'),'changed');assert.equal(unchangedEvidenceSource({root,commit,paths:['src']}),false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
