import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {ContextKernel} from '../../src/context-kernel.js';

const outputIndex=process.argv.indexOf('--output');
const output=outputIndex>=0?process.argv[outputIndex+1]:null;
const domain={type:'integer',min:0,max:1023};
const guess=500;
const warmups=25;
const pairs=500;

function rng(seed){
  let state=seed>>>0;
  return ()=>{
    state=(Math.imul(1664525,state)+1013904223)>>>0;
    return state/2**32;
  };
}
const random=rng(0x5eed1234);

function makeWorld(secret,label){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),`hush-pcc-timing-${label}-`));
  const kernel=new ContextKernel({dir,passphrase:`timing oracle ${label}`,now:()=>1_800_000_000_000});
  kernel.put('finance.balance',secret,{category:'finance',domain});
  kernel.registerConstraintContract({
    id:'finance.exact-guess',privateRef:{category:'finance'},
    extractor:{kind:'number',min:domain.min,max:domain.max,integer:true},
    release:{op:'compare',label:'Private balance equals public guess',operator:'eq',arg:guess}
  });
  return {kernel,dir,label};
}

function prepare(world){
  const started=process.hrtime.bigint();
  const prepared=world.kernel.prepareConstraintRelease({
    contractId:'finance.exact-guess',agent:'adversarial-agent',sink:'model.example'
  });
  const elapsed=process.hrtime.bigint()-started;
  if(prepared.decision!=='ask') throw new Error(`Unexpected public decision in ${world.label}`);
  return Number(elapsed);
}

function timePair(left,right){
  let leftNs,rightNs;
  if(random()<0.5){
    leftNs=prepare(left);
    rightNs=prepare(right);
  }else{
    rightNs=prepare(right);
    leftNs=prepare(left);
  }
  return {leftNs,rightNs,logRatio:Math.log(leftNs/rightNs)};
}

function median(values){
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
}

function logAdd(a,b){
  if(a===-Infinity) return b;
  if(b===-Infinity) return a;
  const hi=Math.max(a,b),lo=Math.min(a,b);
  return hi+Math.log1p(Math.exp(lo-hi));
}

function exactTwoSidedSignP(positive,negative){
  const n=positive+negative;
  if(n===0) return 1;
  const k=Math.min(positive,negative);
  let logTerm=-n*Math.log(2),logTail=-Infinity;
  for(let i=0;i<=k;i++){
    if(i>0) logTerm+=Math.log(n-i+1)-Math.log(i);
    logTail=logAdd(logTail,logTerm);
  }
  return Math.min(1,2*Math.exp(logTail));
}

const worlds={
  equal:makeWorld(500,'equal-withheld'),
  unequal:makeWorld(501,'unequal-allowed'),
  nullA:makeWorld(501,'null-allowed-a'),
  nullB:makeWorld(502,'null-allowed-b')
};

try{
  for(let i=0;i<warmups;i++){
    timePair(worlds.equal,worlds.unequal);
    timePair(worlds.nullA,worlds.nullB);
  }

  const target=[],control=[],adjusted=[];
  for(let i=0;i<pairs;i++){
    const targetPair=timePair(worlds.equal,worlds.unequal);
    const controlPair=timePair(worlds.nullA,worlds.nullB);
    const adjustedLogRatio=targetPair.logRatio-controlPair.logRatio;
    target.push(targetPair);
    control.push(controlPair);
    adjusted.push(adjustedLogRatio);
  }

  const adjustedMedian=median(adjusted);
  const direction=Math.sign(adjustedMedian);
  const positive=adjusted.filter(value=>value>0).length;
  const negative=adjusted.filter(value=>value<0).length;
  const directional=Math.max(positive,negative)/(positive+negative||1);
  const blockMedians=Array.from({length:5},(_,block)=>median(adjusted.slice(block*100,(block+1)*100)));
  const agreeingBlocks=blockMedians.filter(value=>Math.sign(value)===direction).length;
  const pValue=exactTwoSidedSignP(positive,negative);
  const adjustedRatio=Math.exp(adjustedMedian);
  const gates={
    minimum_effect:Math.abs(adjustedRatio-1)>=0.05,
    direction_consistency:directional>=0.65,
    sign_test:pValue<0.001,
    block_consistency:agreeingBlocks>=4
  };
  const fail=Object.values(gates).every(Boolean);
  const result={
    study:'PCC preparation timing-oracle differential',
    protocol:{domain,guess,warmups,pairs,seed:'0x5eed1234',clock:'process.hrtime.bigint'},
    environment:{node:process.version,platform:process.platform,arch:process.arch},
    observations:{
      targetMedianNs:{equal:median(target.map(row=>row.leftNs)),unequal:median(target.map(row=>row.rightNs))},
      nullMedianNs:{a:median(control.map(row=>row.leftNs)),b:median(control.map(row=>row.rightNs))},
      adjustedMedianLogRatio:adjustedMedian,
      adjustedMedianRatio:adjustedRatio,
      positive,negative,directionalConsistency:directional,
      exactTwoSidedSignP:pValue,blockMedians,agreeingBlocks
    },
    gates,
    verdict:fail?'FAIL_TIMING_ORACLE':'PASS_WITHIN_TESTED_RESOLUTION',
    raw:{target,control,adjustedLogRatios:adjusted}
  };
  const serialized=JSON.stringify(result,null,2)+'\n';
  if(output) fs.writeFileSync(output,serialized);
  process.stdout.write(serialized);
}finally{
  for(const world of Object.values(worlds)) fs.rmSync(world.dir,{recursive:true,force:true});
}
