import {execFileSync} from 'node:child_process';

const hash=/^[0-9a-f]{40}$/;
const digest=/^sha256:[0-9a-f]{64}$/;
function publicHttps(value){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!/(^|\.)(example|localhost|invalid)(\.|$)/.test(u.hostname)&&!u.hostname.endsWith('.local');}catch{return false;}
}

export function unchangedEvidenceSource({root,commit,paths}){
  if(!hash.test(commit)||!paths?.length)return false;
  try{
    execFileSync('git',['cat-file','-e',`${commit}^{commit}`],{cwd:root,stdio:'ignore'});
    // Includes staged/unstaged edits; evidence cannot pass against a dirty build.
    execFileSync('git',['diff','--exit-code',commit,'--',...paths],{cwd:root,stdio:'ignore'});
    const untracked=execFileSync('git',['ls-files','--others','--exclude-standard','--',...paths],{cwd:root,encoding:'utf8'});
    return !untracked.trim();
  }catch{return false;}
}

// Checks evidence scope and identity locally. This is not an independent audit
// or a network verification of a reviewer's attestation.
export function validateReleaseEvidence(value,{root,paths,requireArtifacts=false,requireIndependent=false,requirement=null,now=Date.now(),verifySource=unchangedEvidenceSource}={}){
  const block=reason=>({pass:false,reason});
  if(value?.schema!=='hush.release-evidence.v2'||value.status!=='pass')return block('missing completed v2 evidence');
  const issued=Date.parse(value.issuedAt);
  if(typeof value.issuedAt!=='string'||!Number.isFinite(issued)||issued>now+300_000)return block('invalid or future issue time');
  if(!hash.test(value.commit||''))return block('missing exact source commit');
  if(typeof value.scope!=='string'||!value.scope.trim()||typeof value.limitations!=='string'||!value.limitations.trim())return block('scope and limitations are required');
  if(typeof value.evidence!=='string'||!value.evidence.trim()||!Array.isArray(value.evidenceUrls)||!value.evidenceUrls.length||!value.evidenceUrls.every(publicHttps))return block('checkable HTTPS evidence URLs are required');
  if(requireArtifacts){
    if(!Array.isArray(value.artifacts)||!value.artifacts.length||value.artifacts.some(a=>!digest.test(a.digest||'')||!(a.name||a.platform)||!publicHttps(a.url)))return block('identified artifacts with SHA256 and evidence URLs are required');
    if(value.artifacts.some(a=>a.expiresAt&&(!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=now)))return block('evidence artifact expired');
  }
  if(requireIndependent&&(!value.reviewer?.name?.trim()||!value.reviewer?.organization?.trim()||value.reviewer.independent!==true))return block('independent reviewer identity is required');
  const v=value.validation||{};
  if(requirement==='reliability-soak'&&(v.schema!=='hush.durability-soak.v2'||v.commit!==value.commit||v.status!=='pass'||!(v.cumulativeActiveMs>=259_200_000)||!(v.wallMs>=259_200_000)||!(v.totalCrashes>=20)||v.coverageComplete!==true||v.full72HourSatisfied!==true))return block('completed 72-hour active/wall time and crash coverage are required');
  if(requirement==='distribution-signing'&&(!v.signedPlatforms?.includes('win32')||!v.signedPlatforms?.includes('darwin')||v.macNotarizationVerified!==true||v.artifactSignaturesVerified!==true))return block('verified Windows/macOS signatures and macOS notarization are required');
  if(requirement==='platform-keystore'&&(v.backends?.win32!=='windows-dpapi'||v.backends?.darwin!=='macos-keychain'||v.backends?.linux!=='linux-secret-service'||v.noPlaintextFallback!==true))return block('all three packaged OS backends without plaintext fallback are required');
  if(['google-oauth-production','github-app-production'].includes(requirement)&&(v.productionRegistration!==true||v.leastPrivilegeVerified!==true||v.revocationVerified!==true))return block('production registration, least privilege and revocation evidence are required');
  if(requirement==='accessibility-usability'&&['keyboard','screenReader','focus','contrast','zoom','firstRun','storageFailure','recovery'].some(k=>v[k]!==true))return block('completed assistive-technology and first-run/recovery validation is required');
  if(requirement==='incident-drill'&&(!v.owner?.trim()||v.incidentExerciseCompleted!==true||v.rollbackExerciseCompleted!==true))return block('accountable incident owner and completed incident/rollback exercise are required');
  if(!verifySource({root,commit:value.commit,paths}))return block('evidence source differs from the candidate or cannot be verified');
  return {pass:true,reason:'scoped evidence references accepted; external authenticity requires release review',commit:value.commit};
}
