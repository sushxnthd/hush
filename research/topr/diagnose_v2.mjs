import fs from 'node:fs';
import crypto from 'node:crypto';
const posPath=process.argv[2]||'/tmp/topr-v2.json';
const negPath=process.argv[3]||'/tmp/topr-v2-neg.json';
function load(p){const b=fs.readFileSync(p);return {sha256:crypto.createHash('sha256').update(b).digest('hex'),data:JSON.parse(b.toString('utf8'))};}
const P=load(posPath),N=load(negPath);
const arr=x=>Array.isArray(x)?x:Object.values(x??{});
const pos=arr(P.data),neg=arr(N.data);
function summarize(rows){
 const keys=new Map(),toolCounts=new Map(),supportSizes=new Map(),domains=new Map(),difficulty=new Map(),schemas=new Map();
 for(const r of rows){
  for(const k of Object.keys(r??{}))keys.set(k,(keys.get(k)||0)+1);
  const tools=arr(r?.available_tools??r?.tools??r?.trajectory??[]);
  toolCounts.set(tools.length,(toolCounts.get(tools.length)||0)+1);
  const ss=arr(r?.minimal_supporting_set??r?.supporting_set??[]);
  supportSizes.set(ss.length,(supportSizes.get(ss.length)||0)+1);
  const d=String(r?.privacy_domain??r?.domain??'');domains.set(d,(domains.get(d)||0)+1);
  const diff=String(r?.difficulty??r?.difficulty_level??'');difficulty.set(diff,(difficulty.get(diff)||0)+1);
  const toolKey=tools.length?Object.keys(tools[0]??{}).sort().join(','):'(none)';schemas.set(toolKey,(schemas.get(toolKey)||0)+1);
 }
 const sortNum=m=>[...m].sort((a,b)=>Number(a[0])-Number(b[0]));
 const sortCount=m=>[...m].sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
 return {n:rows.length,recordKeys:sortCount(keys),toolCount:sortNum(toolCounts),supportSize:sortNum(supportSizes),domains:sortCount(domains),difficulty:sortCount(difficulty),toolSchemas:sortCount(schemas).slice(0,10)};
}
const report={positiveSha256:P.sha256,negativeSha256:N.sha256,positive:summarize(pos),negative:summarize(neg)};
console.log(JSON.stringify(report,null,2));
fs.mkdirSync('research/topr/out',{recursive:true});fs.writeFileSync('research/topr/out/v2-diagnostics.json',JSON.stringify(report,null,2)+'\n');
