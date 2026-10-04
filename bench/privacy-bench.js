import {DisclosureLedger, TrustRegistry, disclosureCost} from '../src/privacy.js';

function lcg(seed=42){let s=seed>>>0;return()=>((s=(1664525*s+1013904223)>>>0)/2**32)}
const rnd=lcg(20261004);
const cats=['identity','finance','health','relationship','location','work','preference','general'];
const levels=['derived','coarse','exact'];
const sinks=['merchant.example','travel.example','social.example'];
function request(i){const category=cats[Math.floor(rnd()*cats.length)],level=levels[Math.floor(rnd()*levels.length)];return{agent:'adversarial-agent',purpose:'assistant-task',sink:sinks[Math.floor(rnd()*sinks.length)],category,level,atomId:`${category}-${i}`}}
function perCallAllows(q){if(q.category==='credential')return false;if(['identity','finance','health','relationship'].includes(q.category)&&q.level==='exact')return false;return true}
function iSafe(x){let h=0;for(const c of x)h=(h*31+c.charCodeAt(0))%97;return h}
const N=10000,STEPS=18,leakThreshold=8;let naiveLeaks=0,perCallLeaks=0,supaLeaks=0,naiveExposure=0,perCallExposure=0,supaExposure=0,supaAsks=0,supaDenies=0;
for(let t=0;t<N;t++){
  const reqs=Array.from({length:STEPS},(_,i)=>request(t*STEPS+i));let n=0,p=0,s=0;
  const tr=new TrustRegistry('limited'),ledger=new DisclosureLedger({trustRegistry:tr,windowMs:999999999});
  for(const q of reqs){const c=disclosureCost(q.category,q.level);n+=c;if(perCallAllows(q))p+=c;const e=ledger.evaluate(q,100000+t*100+iSafe(q.atomId));if(e.decision==='allow'){s+=e.marginalCost;ledger.record(q,e,100000+t*100+iSafe(q.atomId))}else if(e.decision==='ask')supaAsks++;else supaDenies++}
  naiveExposure+=n;perCallExposure+=p;supaExposure+=s;if(n>=leakThreshold)naiveLeaks++;if(p>=leakThreshold)perCallLeaks++;if(s>=leakThreshold)supaLeaks++;
}
const pct=x=>(100*x/N).toFixed(2)+'%';
console.log(JSON.stringify({trajectories:N,stepsPerTrajectory:STEPS,syntheticLeakThreshold:leakThreshold,leakRate:{allowAll:pct(naiveLeaks),perCallFilter:pct(perCallLeaks),supakeep:pct(supaLeaks)},meanAutomaticExposure:{allowAll:+(naiveExposure/N).toFixed(2),perCallFilter:+(perCallExposure/N).toFixed(2),supakeep:+(supaExposure/N).toFixed(2)},supakeep:{asks:supaAsks,denies:supaDenies}},null,2));
