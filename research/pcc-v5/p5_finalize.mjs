import fs from 'node:fs';
import crypto from 'node:crypto';
const [,,a,b,out='research/pcc-v5/out/p5-final.json']=process.argv;if(!a||!b)throw new Error('usage: node p5_finalize.mjs run1 run2 [out]');
const A=JSON.parse(fs.readFileSync(a,'utf8')),B=JSON.parse(fs.readFileSync(b,'utf8'));
function discrete(x){return x.perInstance.map(r=>({sampleId:r.sampleId,raw:r.output.raw,lexical:r.output.lexical,pcc:r.output.pcc,rawScore:r.raw,lexicalScore:r.lexical,pccScore:r.pcc}));}
const da=JSON.stringify(discrete(A)),db=JSON.stringify(discrete(B)),same=da===db;
const h=x=>crypto.createHash('sha256').update(x).digest('hex');
const final={...A,gates:{...A.gates,reproducibility:same},overallPass:false,reproducibility:{identicalDiscreteOutputs:same,run1DiscreteSha256:h(da),run2DiscreteSha256:h(db)}};
final.overallPass=Object.values(final.gates).every(Boolean);
fs.mkdirSync(out.split('/').slice(0,-1).join('/')||'.',{recursive:true});fs.writeFileSync(out,JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({study:final.study,p5Records:final.dataset.p5Records,privacyTypes:final.dataset.privacyTypes,datasetSha256:final.dataset.sha256,datasetRevision:final.dataset.revision,compilerCommit:final.software.compilerCommit,evaluatorCommit:final.software.evaluatorCommit,arms:final.arms,paired:final.paired,diagnostics:final.diagnostics,gates:final.gates,overallPass:final.overallPass,reproducibility:final.reproducibility},null,2));
process.exitCode=final.overallPass?0:2;
