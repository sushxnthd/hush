import {DisclosureLedger, TrustRegistry} from '../src/privacy.js';
function lcg(seed=7){let s=seed>>>0;return()=>((s=(1664525*s+1013904223)>>>0)/2**32)}
const rnd=lcg(20261005),cats=['general','preference','work','location'],levels=['derived','coarse'],sinks=['calendar.example','travel.example'];
const N=10000,STEPS=6;let allowed=0,asked=0,denied=0,complete=0;
for(let t=0;t<N;t++){
 const tr=new TrustRegistry('standard'),l=new DisclosureLedger({trustRegistry:tr,windowMs:999999999});let ok=true;
 for(let i=0;i<STEPS;i++){
  const q={agent:'assistant',purpose:'benign-task',sink:sinks[Math.floor(rnd()*sinks.length)],category:cats[Math.floor(rnd()*cats.length)],level:levels[Math.floor(rnd()*levels.length)],atomId:`${t}-${i}`};
  const e=l.evaluate(q,1000+t*10+i);
  if(e.decision==='allow'){allowed++;l.record(q,e,1000+t*10+i)}else{ok=false;e.decision==='ask'?asked++:denied++}
 }
 if(ok)complete++;
}
console.log(JSON.stringify({trajectories:N,steps:STEPS,automaticDecisionRate:{allow:(allowed/(N*STEPS)*100).toFixed(2)+'%',ask:(asked/(N*STEPS)*100).toFixed(2)+'%',deny:(denied/(N*STEPS)*100).toFixed(2)+'%'},fullyAutomaticTaskRate:(complete/N*100).toFixed(2)+'%'},null,2));
