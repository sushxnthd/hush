import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {validateReleaseEvidence} from '../src/release-evidence.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=p=>fs.existsSync(path.join(root,p));
const text=p=>exists(p)?fs.readFileSync(path.join(root,p),'utf8'):'';
const contains=(p,needle)=>text(p).includes(needle);
const evidenceResults=new Map();
function attestation(file){
  const name=path.basename(file,'.json');
  const legal=name==='legal-support-surface';
  const requireIndependent=['privacy-reproduction','independent-reproduction','security-review'].includes(name);
  const requireArtifacts=['platform-keystore','real-actions-e2e','reliability-soak','recovery-drill','distribution-signing','update-rollback','sbom-checksums'].includes(name);
  const paths=legal?['scripts/write-product-site.mjs','scripts/reference-pages.mjs','PRIVACY.md','TERMS.md','SUPPORT.md','SECURITY.md']:['src','clients','public','package.json','scripts/build-release.mjs','scripts/release-verify.mjs','scripts/release-runtime-smoke.mjs',...(requireIndependent?['research','bench']:[])];
  let result={pass:false,reason:'evidence file missing'};
  if(exists(file)){try{result=validateReleaseEvidence(JSON.parse(text(file)),{root,paths,requireIndependent,requireArtifacts,requirement:name});}catch{result={pass:false,reason:'invalid evidence JSON'};}}
  evidenceResults.set(file,result);
  return result.pass;
}

const dimensions=[
  {
    name:'Privacy & minimization',
    engineering:[
      ['PCC v2 untouched confirmatory result',()=>contains('research/pcc-v2/P2_CONFIRMATORY_RESULTS.md','Status: **PASS**')],
      ['external AgentCIBench evidence',()=>exists('research/results/AGENTCIBENCH_CONFIRMATORY_V1.md')],
      ['cumulative privacy/reconstruction defenses',()=>exists('src/reconstruction-firewall.js')&&exists('src/joint-choice-firewall.js')]
    ],
    release:[['independent privacy reproduction',()=>attestation('release/attestations/privacy-reproduction.json')]]
  },
  {
    name:'Keys, credentials & local security',
    engineering:[
      ['OS-backed root-key implementation',()=>exists('src/platform-key-store.js')],
      ['Context Kernel auto-unlock from derived root key',()=>contains('src/server.js','deriveContextPassphrase(rootKeyInfo.key)')],
      ['signed receipt chain',()=>exists('src/receipt-security.js')&&contains('src/server.js','signReceipt')],
      ['loopback host/origin defense',()=>exists('src/local-http-security.js')],
      ['authenticated normal startup',()=>contains('src/server.js','required:policy.localClientAuth')&&contains('src/runtime-policy.js',"env.HUSH_REQUIRE_LOCAL_AUTH!=='0'")],
      ['bounded request/response handling',()=>exists('src/http-io.js')&&contains('src/client-sdk.js','readResponseText(response,MAX_TEXT_BYTES)')]
    ],
    release:[['packaged-build keystore verification',()=>attestation('release/attestations/platform-keystore.json')]]
  },
  {
    name:'Zero-terminal onboarding & connectors',
    engineering:[
      ['Google PKCE onboarding',()=>contains('src/provider-onboarding.js',"pkce:'S256'")],
      ['GitHub device authorization',()=>contains('src/provider-onboarding.js','GITHUB_DEVICE')],
      ['browser connection lifecycle UI',()=>contains('clients/browser/popup.js','providerAction')],
      ['one-click bounded sync',()=>contains('src/provider-onboarding.js','syncConnectorToKernel')],
      ['credential-free local MCP configuration',()=>exists('clients/desktop/hush-mcp.mjs')&&contains('clients/desktop/hush-desktop.mjs',"command==='mcp-config'")]
    ],
    release:[
      ['Google production OAuth registration',()=>attestation('release/attestations/google-oauth-production.json')],
      ['GitHub production app registration',()=>attestation('release/attestations/github-app-production.json')]
    ]
  },
  {
    name:'Authority & real actions',
    engineering:[
      ['secretless action broker',()=>exists('src/action-broker.js')],
      ['universal consent engine',()=>exists('src/consent.js')],
      ['action benchmark',()=>exists('bench/secretless-action-broker.js')]
    ],
    release:[['real provider action E2E',()=>attestation('release/attestations/real-actions-e2e.json')]]
  },
  {
    name:'Reliability & data durability',
    engineering:[
      ['atomic persisted state writes',()=>contains('src/core.js','fs.fsyncSync')&&contains('src/core.js','fs.renameSync')],
      ['single-runtime lock',()=>exists('src/runtime-lock.js')],
      ['per-user runtime storage',()=>exists('src/runtime-paths.js')&&contains('src/server.js',"stateLocation:'user-data'")],
      ['three-OS CI matrix',()=>contains('.github/workflows/ci.yml','windows-latest')&&contains('.github/workflows/ci.yml','macos-latest')]
    ],
    release:[['72h crash/restart/soak run',()=>attestation('release/attestations/reliability-soak.json')]]
  },
  {
    name:'Sync, recovery & revocation',
    engineering:[
      ['signed encrypted sync',()=>exists('src/sync.js')],
      ['recovery tests',()=>text('test/sync.test.js').includes('recovery')||[...fs.readdirSync(path.join(root,'test'))].some(name=>name.includes('sync'))],
      ['provider disconnect/revoke path',()=>contains('src/provider-onboarding.js','disconnect(provider')]
    ],
    release:[['fresh-machine recovery drill',()=>attestation('release/attestations/recovery-drill.json')]]
  },
  {
    name:'Consumer UX & accessibility',
    engineering:[
      ['browser companion',()=>exists('clients/browser/popup.html')&&exists('clients/browser/popup.js')],
      ['desktop companion',()=>exists('clients/desktop/hush-desktop.mjs')],
      ['mobile companion',()=>exists('clients/mobile/mobile.js')]
    ],
    release:[['accessibility/usability audit',()=>attestation('release/attestations/accessibility-usability.json')]]
  },
  {
    name:'Distribution, updates & supply chain',
    engineering:[
      ['CodeQL workflow',()=>exists('.github/workflows/codeql.yml')&&contains('.github/workflows/codeql.yml','github/codeql-action/analyze@v4')],
      ['dependency-free core runtime',()=>{const p=JSON.parse(text('package.json'));return !Object.keys(p.dependencies||{}).length&&!Object.keys(p.optionalDependencies||{}).length;}]
    ],
    release:[
      ['signed/notarized installers',()=>attestation('release/attestations/distribution-signing.json')],
      ['update + rollback verification',()=>attestation('release/attestations/update-rollback.json')],
      ['release SBOM/checksums',()=>attestation('release/attestations/sbom-checksums.json')]
    ]
  },
  {
    name:'Security assurance & abuse resistance',
    engineering:[
      ['threat model',()=>exists('THREAT_MODEL.md')],
      ['security policy',()=>exists('SECURITY.md')],
      ['adversarial privacy benchmarks',()=>exists('bench/cross-agent-collusion.js')&&exists('bench/symbolic-joint-choice.js')]
    ],
    release:[['independent security review/red team',()=>attestation('release/attestations/security-review.json')]]
  },
  {
    name:'External validation, operations & compliance',
    engineering:[
      ['independent reproduction request',()=>exists('research/pcc-v2/REPRODUCE.md')],
      ['production acceptance contract',()=>exists('V1_2_ACCEPTANCE.md')]
    ],
    release:[
      ['independent reproduction completed',()=>attestation('release/attestations/independent-reproduction.json')],
      ['privacy/terms/support surface published',()=>attestation('release/attestations/legal-support-surface.json')],
      ['incident/rollback owner drill',()=>attestation('release/attestations/incident-drill.json')]
    ]
  }
];

let engineeringPassed=0,engineeringTotal=0,releaseDomains=0;
const report=[];
const jsonMode=process.argv.includes('--json');
for(const dimension of dimensions){
  const e=dimension.engineering.map(([label,fn])=>[label,Boolean(fn())]);
  const r=dimension.release.map(([label,fn])=>[label,Boolean(fn())]);
  engineeringPassed+=e.filter(([,ok])=>ok).length;
  engineeringTotal+=e.length;
  const domainPass=e.every(([,ok])=>ok)&&r.every(([,ok])=>ok);
  if(domainPass) releaseDomains++;
  report.push({name:dimension.name,status:domainPass?'pass':'block',engineering:e.map(([label,pass])=>({label,pass})),release:r.map(([label,pass])=>({label,pass}))});
  if(!jsonMode){console.log(`\n${domainPass?'PASS':'BLOCK'}  ${dimension.name}`);for(const [label,ok] of [...e,...r])console.log(`  ${ok?'✓':'✗'} ${label}`);}
}
const engineeringPct=Math.round((engineeringPassed/engineeringTotal)*1000)/10;
if(jsonMode)console.log(JSON.stringify({schema:'hush.production-readiness.v2',checkedAt:new Date().toISOString(),status:releaseDomains===10?'pass':'block',engineering:{passed:engineeringPassed,total:engineeringTotal,percent:engineeringPct},releaseDomains,totalDomains:10,domains:report,evidence:[...evidenceResults].map(([file,result])=>({file,...result})),scope:'Local source and evidence checks. External evidence authenticity and release authorization require accountable review.'},null,2));
else{
console.log(`\nEngineering checks: ${engineeringPassed}/${engineeringTotal} (${engineeringPct}%)`);
console.log(`Strict production score: ${releaseDomains}/10`);
for(const [file,result]of evidenceResults)if(!result.pass)console.log(`  ${path.basename(file)}: ${result.reason}`);
}
if(releaseDomains!==10){
  if(!jsonMode)console.error('\nNOT PRODUCTION READY: every domain must PASS with scoped evidence.');
  process.exitCode=1;
}else if(!jsonMode)console.log('\n10/10 evidence domains passed. Verify external evidence authenticity before authorizing the release.');
