#!/usr/bin/env node
import fs from 'node:fs';
import {verifyObservablePrefixClosure} from '../../src/observable-fiber.js';

const output=process.argv[2]??'research/pcc-runtime-product/observable_fiber_prefix_law_result.json';
const schedule=(mask,n,t)=>Array.from({length:n},(_,s)=>Array.from({length:t},(_,i)=>(mask>>(s*t+i))&1));
const futureRefines=(authorized,horizon)=>{
  for(let prefix=1;prefix<horizon;prefix++){
    const seen=new Map();
    for(const trace of authorized){
      const key=JSON.stringify(trace.slice(0,prefix));
      const full=JSON.stringify(trace);
      if(seen.has(key)&&seen.get(key)!==full)return true;
      seen.set(key,full);
    }
  }
  return false;
};
const shapes=[];
let firstStrict=null;
for(const worlds of [2,3])for(const horizon of [1,2,3]){
  const schedules=1<<(worlds*horizon);
  let total=0,prefixSafe=0,finalSafe=0,finalOnlySafe=0,prefixButFinalUnsafe=0,futureRefiningAuthorized=0,strictAuthorized=0,boundaryDisagreements=0;
  for(let a=0;a<schedules;a++){
    const authorized=schedule(a,worlds,horizon);
    const predictsStrict=futureRefines(authorized,horizon);
    if(predictsStrict)futureRefiningAuthorized++;
    let observedStrict=false;
    for(let o=0;o<schedules;o++){
      const observable=schedule(o,worlds,horizon);
      const rows=Array.from({length:worlds},(_,secretId)=>({secretId,publicInput:'fixed',authorized:authorized[secretId],observable:observable[secretId]}));
      const checked=verifyObservablePrefixClosure(rows);
      total++;
      if(checked.safe)prefixSafe++;
      if(checked.finalSafe)finalSafe++;
      if(checked.finalSafe&&!checked.safe){
        finalOnlySafe++;
        observedStrict=true;
        if(!firstStrict)firstStrict={worlds,horizon,authorized,observable,witness:checked.witness};
      }
      if(checked.safe&&!checked.finalSafe)prefixButFinalUnsafe++;
    }
    if(observedStrict)strictAuthorized++;
    if(observedStrict!==predictsStrict)boundaryDisagreements++;
  }
  shapes.push({worlds,horizon,total,prefixSafe,finalSafe,finalOnlySafe,prefixButFinalUnsafe,futureRefiningAuthorized,strictAuthorized,boundaryDisagreements});
}

const channelFixtures={
  status:[['pending','done'],['ready','done']],
  byteLength:[[0,16],[16,0]],
  eventOrder:[['metadata','result'],['result','metadata']],
  multiplicity:[[0,2],[2,0]],
  workCount:[[0,100],[100,0]]
};
const fixtureResults={};
for(const [name,observable] of Object.entries(channelFixtures)){
  const full=verifyObservablePrefixClosure([0,1].map(secretId=>({secretId,publicInput:'fixed',authorized:[null,null],observable:observable[secretId]})));
  const total=verifyObservablePrefixClosure([0,1].map(secretId=>({secretId,publicInput:'fixed',authorized:[null],observable:[name==='workCount'?100:name==='byteLength'?16:2]})));
  fixtureResults[name]={fullTraceSafe:full.safe,finalAggregateControlSafe:total.safe,witnessPrefix:full.witness?.prefix??null};
}

const totals=shapes.reduce((a,row)=>{for(const key of ['total','prefixSafe','finalSafe','finalOnlySafe','prefixButFinalUnsafe'])a[key]+=row[key];return a},{total:0,prefixSafe:0,finalSafe:0,finalOnlySafe:0,prefixButFinalUnsafe:0});
const gates={
  exactFrozenTotal:totals.total===270672,
  prefixImpliesFinal:totals.prefixButFinalUnsafe===0,
  noOneStepGap:shapes.filter(row=>row.horizon===1).every(row=>row.finalOnlySafe===0),
  strictGapExists:totals.finalOnlySafe>0,
  minimalStrictWitness:firstStrict?.worlds===2&&firstStrict?.horizon===2,
  exactStructuralBoundary:shapes.every(row=>row.boundaryDisagreements===0&&row.futureRefiningAuthorized===row.strictAuthorized),
  allFiveUnseenChannelsRejected:Object.values(fixtureResults).every(row=>!row.fullTraceSafe&&row.finalAggregateControlSafe)
};
const result={
  schema:'hush.observable-fiber-prefix-law.v1',
  claim:'Prefix-wise factorization is strictly stronger than factorization through the eventual authorized transcript.',
  shapes,totals,firstStrict,fixtureResults,gates,
  status:Object.values(gates).every(Boolean)?'PASS_PREFIX_LAW_AND_CHECKER':'FAIL'
};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,totals,gates}));
