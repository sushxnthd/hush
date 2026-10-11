#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';
import {ProviderOnboarding} from '../../src/provider-onboarding.js';

class MemoryVault{
  constructor(){this.items=[];this.n=0;}
  list(){return this.items.map(({value,...safe})=>structuredClone(safe));}
  put({label,type,value,tags=[]}){const item={id:`v${++this.n}`,label,type,value,tags,createdAt:1};this.items.push(item);const{value:_,...safe}=item;return safe;}
  resolve(id){const item=this.items.find(row=>row.id===id);if(!item)throw new Error('Vault item not found');return item.value;}
  remove(id){const before=this.items.length;this.items=this.items.filter(row=>row.id!==id);return before!==this.items.length;}
}

const response=payload=>({ok:true,status:200,json:async()=>structuredClone(payload)});
const stateOf=started=>new URL(started.authorizationUrl).searchParams.get('state');
function containsExact(value,target){
  if(value===target) return true;
  if(typeof target==='string'&&typeof value==='string') return value.includes(target);
  if(Array.isArray(value)) return value.some(item=>containsExact(item,target));
  if(value&&typeof value==='object') return Object.entries(value).some(([key,item])=>key===String(target)||containsExact(item,target));
  return false;
}

async function actionHarness(){
  const vault=new MemoryVault(),providerCalls=[];
  const fetchImpl=async(url,init={})=>{
    const target=String(url);
    if(target==='https://oauth2.googleapis.com/token') return response({access_token:'LOCAL_CALENDAR_TOKEN',refresh_token:'LOCAL_REFRESH',expires_in:3600,scope:'openid email https://www.googleapis.com/auth/calendar.events'});
    if(target.includes('/calendar/v3/calendars/primary/events')){
      providerCalls.push({url:target,body:JSON.parse(init.body)});
      return response({id:`evt-${providerCalls.length}`,status:'confirmed',htmlLink:'https://calendar.example.invalid/event'});
    }
    throw new Error(`unexpected provider URL ${target}`);
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env:{HUSH_GOOGLE_CLIENT_ID:'public-client'},port:8787,now:()=>2000});
  const start=onboarding.startGoogle({connectors:[],actions:['calendar_create']});
  await onboarding.completeGoogle({state:stateOf(start),code:'local-code'});
  return {onboarding,providerCalls};
}

async function executeCalendar(onboarding,choice,caseId){
  if(!choice) return {success:false,approvals:0,receipt:null,replayDenied:false};
  const start=new Date(Date.UTC(2026,9,20,0,choice.minute));
  const ticket=onboarding.requestAction({action:'calendar_create',agent:'scheduler',sink:'calendar',purpose:'schedule approved review',resource:'primary',arguments:{summary:`Public review ${caseId}`,start:start.toISOString(),end:new Date(start.getTime()+30*60*1000).toISOString(),timeZone:'UTC'}});
  onboarding.approveAction(ticket.actionId);
  const result=await onboarding.executeAction({actionId:ticket.actionId,agent:'scheduler',sink:'calendar'});
  let replayDenied=false;
  try{await onboarding.executeAction({actionId:ticket.actionId,agent:'scheduler',sink:'calendar'});}catch{replayDenied=true;}
  return {success:result.decision==='allow'&&result.result?.created===true&&replayDenied,approvals:1,receipt:onboarding.actionReceipts().at(-1),replayDenied};
}

function makeKernel(record,candidates,caseId){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-bundle-'));
  const kernel=new ContextKernel({dir,passphrase:`pcc-bundle-${caseId}`});
  kernel.put('calendar.privatePolicy',record,{label:'Private scheduling policy',category:'calendar',tags:['calendar','availability']});
  const ids=candidates.map((candidate,index)=>{
    const id=`calendar.case-${caseId}.candidate-${index}`;
    kernel.registerConstraintContract({id,privateRef:{category:'calendar'},privateField:'availabilityCutoff',extractor:{kind:'number',min:0,max:1439,integer:true},release:{op:'compare',label:`Candidate ${index+1} allowed`,operator:'gte',arg:candidate.minute,trueLabel:'yes',falseLabel:'no'}});
    return id;
  });
  return {kernel,dir,ids};
}

function separatePayload(record,candidates,caseId){
  const {kernel,dir,ids}=makeKernel(record,candidates,caseId);
  const payload=[],preparations=[],receipts=[];
  for(const id of ids){
    const prepared=kernel.prepareConstraintRelease({contractId:id,task:'choose an acceptable public meeting slot',agent:'scheduler',sink:'model.example',purpose:'calendar scheduling'});
    preparations.push(prepared);
    kernel.approveConstraintRelease(prepared.releaseId);
    const released=kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'scheduler',sink:'model.example'});
    payload.push(released.constraint);receipts.push(released.receipt);
    let denied=false;try{kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'scheduler',sink:'model.example'});}catch{denied=true;}
    if(!denied) throw new Error('separate release replay was not denied');
  }
  fs.rmSync(dir,{recursive:true,force:true});
  return {payload,preparations,receipts,approvals:2,capacityBits:2,constraintReplayDenied:true};
}

function bundledPayload(record,candidates,caseId){
  const {kernel,dir,ids}=makeKernel(record,candidates,caseId);
  const prepared=kernel.prepareConstraintReleaseBundle({contractIds:ids,maxBits:2,task:'choose an acceptable public meeting slot',agent:'scheduler',sink:'model.example',purpose:'calendar scheduling'});
  kernel.approveConstraintReleaseBundle(prepared.bundleId);
  const released=kernel.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'scheduler',sink:'model.example'});
  let replayDenied=false;try{kernel.consumeConstraintReleaseBundle({bundleId:prepared.bundleId,agent:'scheduler',sink:'model.example'});}catch{replayDenied=true;}
  fs.rmSync(dir,{recursive:true,force:true});
  return {payload:released.constraints,preparations:[prepared],receipts:[released.receipt],approvals:1,capacityBits:released.capacityBits,constraintReplayDenied:replayDenied};
}

async function main(){
  const startIndex=process.argv.indexOf('--case-start');
  const caseStart=startIndex>=0?Number(process.argv[startIndex+1]):0;
  if(!Number.isInteger(caseStart)||caseStart<0||caseStart>1000000) throw new Error('case-start must be a bounded non-negative integer');
  const arms=['pcc_separate','pcc_bundled'];
  const metrics=Object.fromEntries(arms.map(arm=>[arm,{cases:0,task_success:0,action_success:0,cutoff_disclosures:0,canary_disclosures:0,provider_source_disclosures:0,receipt_disclosures:0,approvals:0,capacity_two:0,replay_denied:0,inference_protected:0,final_remaining_thirty:0,total_latency_ns:0}]));
  const discrete=[];
  const {onboarding,providerCalls}=await actionHarness();
  for(let offset=0;offset<256;offset++){
    const caseId=caseStart+offset;
    const cutoff=120+caseId;
    const canary=`HEALTH_${crypto.createHash('sha256').update(`case-${caseId}`).digest('hex').slice(0,20)}`;
    const record={availabilityCutoff:cutoff,privateNote:canary,ownerEmail:`private-${caseId}@example.invalid`};
    const candidates=[{id:'A',minute:cutoff-15},{id:'B',minute:cutoff+15}];
    for(const arm of arms){
      const before=process.hrtime.bigint();
      const release=arm==='pcc_separate'?separatePayload(record,candidates,caseId):bundledPayload(record,candidates,caseId);
      const choice=candidates.find((_,index)=>release.payload[index]?.value===true)??null;
      const actionStart=providerCalls.length;
      const action=await executeCalendar(onboarding,choice,`${caseId}-${arm}`);
      const providerView=providerCalls.slice(actionStart);
      const receiptView={preparations:release.preparations,receipts:release.receipts,action:action.receipt};
      const sourceAtProvider=containsExact(providerView,canary)||containsExact(providerView,'availabilityCutoff')||containsExact(providerView,cutoff);
      const sourceInReceipt=containsExact(receiptView,canary)||containsExact(receiptView,'availabilityCutoff')||containsExact(receiptView,cutoff);
      const metric=metrics[arm];
      metric.cases++;metric.task_success+=choice?.id==='A';metric.action_success+=action.success;
      metric.cutoff_disclosures+=containsExact(release.payload,cutoff);metric.canary_disclosures+=containsExact(release.payload,canary);
      metric.provider_source_disclosures+=sourceAtProvider;metric.receipt_disclosures+=sourceInReceipt;
      metric.approvals+=release.approvals+action.approvals;metric.capacity_two+=release.capacityBits===2;
      metric.replay_denied+=release.constraintReplayDenied&&action.replayDenied;metric.total_latency_ns+=Number(process.hrtime.bigint()-before);
      metric.inference_protected+=release.receipts.length>0&&release.receipts.every(receipt=>receipt.inferenceProtection?.accounting==='realized-partition');
      metric.final_remaining_thirty+=release.receipts.at(-1)?.inferenceProtection?.afterCandidates===30;
      discrete.push({caseId,arm,choice:choice?.id??null,actionSuccess:action.success,modelCutoff:containsExact(release.payload,cutoff),modelCanary:containsExact(release.payload,canary),providerSource:sourceAtProvider,receiptSource:sourceInReceipt,approvals:release.approvals+action.approvals,capacityBits:release.capacityBits,replayDenied:release.constraintReplayDenied&&action.replayDenied,inferenceProtected:release.receipts.every(receipt=>receipt.inferenceProtection?.accounting==='realized-partition'),finalRemaining:release.receipts.at(-1)?.inferenceProtection?.afterCandidates??null});
    }
  }
  for(const metric of Object.values(metrics)){metric.mean_latency_ms=metric.total_latency_ns/metric.cases/1e6;delete metric.total_latency_ns;}
  const gates={
    utility:arms.every(arm=>metrics[arm].task_success===256&&metrics[arm].action_success===256),
    model_non_disclosure:arms.every(arm=>metrics[arm].cutoff_disclosures===0&&metrics[arm].canary_disclosures===0),
    boundary_non_disclosure:arms.every(arm=>metrics[arm].provider_source_disclosures===0&&metrics[arm].receipt_disclosures===0),
    bundle_capacity:metrics.pcc_bundled.capacity_two===256,
    approvals:metrics.pcc_separate.approvals===768&&metrics.pcc_bundled.approvals===512,
    one_shot:arms.every(arm=>metrics[arm].replay_denied===256),
    inference_firewall:arms.every(arm=>metrics[arm].inference_protected===256&&metrics[arm].final_remaining_thirty===256)
  };
  const result={study:'PCC bounded approval bundle',case_start:caseStart,cases:256,metrics,gates,overall:Object.values(gates).every(Boolean)?'PASS':'FAIL',discrete_sha256:crypto.createHash('sha256').update(JSON.stringify(discrete)).digest('hex')};
  const rendered=JSON.stringify(result,null,2)+'\n';
  const outputIndex=process.argv.indexOf('--output');if(outputIndex>=0) fs.writeFileSync(process.argv[outputIndex+1],rendered);
  process.stdout.write(rendered);
}

await main();
