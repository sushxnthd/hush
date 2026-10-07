import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=p=>fs.existsSync(path.join(root,p));
const text=p=>exists(p)?fs.readFileSync(path.join(root,p),'utf8'):'';
const contains=(p,needle)=>text(p).includes(needle);
function attestation(file){
  if(!exists(file)) return false;
  try{
    const value=JSON.parse(text(file));
    return value.status==='pass'&&typeof value.evidence==='string'&&value.evidence.trim().length>0&&typeof value.issuedAt==='string';
  }catch{return false;}
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
      ['loopback host/origin defense',()=>exists('src/local-http-security.js')]
    ],
    release:[['packaged-build keystore verification',()=>attestation('release/attestations/platform-keystore.json')]]
  },
  {
    name:'Zero-terminal onboarding & connectors',
    engineering:[
      ['Google PKCE onboarding',()=>contains('src/provider-onboarding.js',"pkce:'S256'")],
      ['GitHub device authorization',()=>contains('src/provider-onboarding.js','GITHUB_DEVICE')],
      ['browser connection lifecycle UI',()=>contains('clients/browser/popup.js','providerAction')],
      ['one-click bounded sync',()=>contains('src/provider-onboarding.js','syncConnectorToKernel')]
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
      ['dependency-free core runtime',()=>!exists('node_modules')&&JSON.parse(text('package.json')).private===true]
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
for(const dimension of dimensions){
  const e=dimension.engineering.map(([label,fn])=>[label,Boolean(fn())]);
  const r=dimension.release.map(([label,fn])=>[label,Boolean(fn())]);
  engineeringPassed+=e.filter(([,ok])=>ok).length;
  engineeringTotal+=e.length;
  const domainPass=e.every(([,ok])=>ok)&&r.every(([,ok])=>ok);
  if(domainPass) releaseDomains++;
  console.log(`\n${domainPass?'PASS':'BLOCK'}  ${dimension.name}`);
  for(const [label,ok] of [...e,...r]) console.log(`  ${ok?'✓':'✗'} ${label}`);
}
const engineeringPct=Math.round((engineeringPassed/engineeringTotal)*1000)/10;
console.log(`\nEngineering checks: ${engineeringPassed}/${engineeringTotal} (${engineeringPct}%)`);
console.log(`Strict production score: ${releaseDomains}/10`);
if(releaseDomains!==10){
  console.error('\nNOT PRODUCTION READY: every domain must PASS with evidence.');
  process.exitCode=1;
}else console.log('\nPRODUCTION READY: 10/10 release domains passed.');
