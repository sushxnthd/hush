import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,scoreTranscript,wilson} from '../polar-p1/evaluate.mjs';
import {compileDisclosureV5,pccV5Summary} from './policy_compiler_v5.mjs';

const input=process.argv[2]||'/tmp/polar.json';const bytes=fs.readFileSync(input),sha=crypto.createHash('sha256').update(bytes).digest('hex');if(sha!==EXPECTED_DATA_SHA256)throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8'));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
function run(level){
 const subset=records.filter(r=>Number(r?.metadata?.privacy_level)===level),scores=[];
 for(const r of subset){const out=compileDisclosureV5(r).text;scores.push(scoreTranscript(out,r.scoring_targets));}
 const leaked=scores.reduce((s,x)=>s+x.protectedRevealed,0),lf=scores.filter(x=>x.leakFree).length,ms=scores.filter(x=>x.minimalSuccess).length;
 return {n:subset.length,privacy:mean(scores.map(x=>x.privacy)),utility:mean(scores.map(x=>x.utility)),overall:mean(scores.map(x=>x.overall)),protectedRevealed:leaked,leakFreeRate:lf/subset.length,leakFreeWilson95:wilson(lf,subset.length),minimalSuccessRate:ms/subset.length,minimalSuccessWilson95:wilson(ms,subset.length)};
}
const result={datasetSha256:sha,compiler:pccV5Summary(),P1:run(1),P2:run(2),P3:run(3),P4:run(4)};
result.pass=[result.P1,result.P2,result.P3,result.P4].every(x=>x.protectedRevealed===0&&x.privacy===1&&x.utility>=0.999&&x.minimalSuccessRate>=0.999);
console.log(JSON.stringify(result,null,2));fs.mkdirSync('research/pcc-v5/out',{recursive:true});fs.writeFileSync('research/pcc-v5/out/dev-regression.json',JSON.stringify(result,null,2)+'\n');if(!result.pass)process.exitCode=2;
