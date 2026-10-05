import fs from 'node:fs';
import crypto from 'node:crypto';

const [run1='research/polar-p1/out/run1.json',run2='research/polar-p1/out/run2.json',out='research/polar-p1/out/final.json']=process.argv.slice(2);
const a=fs.readFileSync(run1), b=fs.readFileSync(run2);
const same=a.equals(b);
const result=JSON.parse(a.toString('utf8'));
result.gates.reproducibility=same;
result.reproducibility={
  identicalDiscreteOutputs:same,
  run1Sha256:crypto.createHash('sha256').update(a).digest('hex'),
  run2Sha256:crypto.createHash('sha256').update(b).digest('hex')
};
result.overallPass=Object.values(result.gates).every(Boolean);
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
const summary={
  study:result.study,
  p1Records:result.dataset.p1Records,
  datasetSha256:result.dataset.sha256,
  datasetRevision:result.dataset.revision,
  evaluatorCommit:result.software.evaluatorCommit,
  arms:result.arms,
  paired:result.paired,
  diagnostics:result.diagnostics,
  gates:result.gates,
  overallPass:result.overallPass,
  reproducibility:result.reproducibility
};
console.log(JSON.stringify(summary,null,2));
