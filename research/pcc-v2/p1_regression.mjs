import fs from 'node:fs';
import crypto from 'node:crypto';
import {EXPECTED_DATA_SHA256,scoreTranscript,wilson} from '../polar-p1/evaluate.mjs';
import {compileDisclosure} from './policy_compiler_v2.mjs';

const input=process.argv[2]||'/tmp/polar.json';
const bytes=fs.readFileSync(input),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==EXPECTED_DATA_SHA256)throw new Error(`dataset hash mismatch ${sha}`);
const records=JSON.parse(bytes.toString('utf8')).filter(r=>Number(r?.metadata?.privacy_level)===1&&String(r?.metadata?.privacy_type)==='explicit_field_constraints');
const scores=[];
for(const r of records){const out=compileDisclosure(r);scores.push(scoreTranscript(out.text,r.scoring_targets));}
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
const protectedRevealed=scores.reduce((s,x)=>s+x.protectedRevealed,0),leakFree=scores.filter(x=>x.leakFree).length,minimal=scores.filter(x=>x.minimalSuccess).length;
const result={datasetSha256:sha,n:records.length,privacy:mean(scores.map(x=>x.privacy)),utility:mean(scores.map(x=>x.utility)),overall:mean(scores.map(x=>x.overall)),protectedRevealed,leakFreeRate:leakFree/records.length,leakFreeWilson95:wilson(leakFree,records.length),minimalSuccessRate:minimal/records.length,minimalSuccessWilson95:wilson(minimal,records.length)};
console.log(JSON.stringify(result,null,2));
if(result.privacy!==1||result.utility!==1||result.protectedRevealed!==0||result.minimalSuccessRate!==1)process.exitCode=2;
