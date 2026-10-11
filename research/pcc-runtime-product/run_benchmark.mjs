#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';
import {sanitizeContextValue} from '../../src/context-sanitizer.js';
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
    if(target==='https://oauth2.googleapis.com/token') return response({
      access_token:'LOCAL_CALENDAR_TOKEN',refresh_token:'LOCAL_REFRESH',expires_in:3600,
      scope:'openid email https://www.googleapis.com/auth/calendar.events'
    });
    if(target.includes('/calendar/v3/calendars/primary/events')){
      providerCalls.push({url:target,body:JSON.parse(init.body),headers:{...init.headers}});
      return response({id:`evt-${providerCalls.length}`,status:'confirmed',htmlLink:'https://calendar.example.invalid/event'});
    }
    throw new Error(`unexpected provider URL ${target}`);
  };
  const onboarding=new ProviderOnboarding({vault,fetchImpl,env:{HUSH_GOOGLE_CLIENT_ID:'public-client'},port:8787,now:()=>2000});
  const start=onboarding.startGoogle({connectors:[],actions:['calendar_create']});
  await onboarding.completeGoogle({state:stateOf(start),code:'local-code'});
  return {onboarding,providerCalls};
}

function modelChoice(arm,payload,candidates){
  if(arm==='raw') return candidates.find(candidate=>candidate.minute<=payload.availabilityCutoff)??null;
  if(arm==='semantic_exact') return candidates.find(candidate=>candidate.minute<=payload.availabilityCutoff)??null;
  if(arm==='strict_redaction') return Number.isFinite(payload.availabilityCutoff)
    ? candidates.find(candidate=>candidate.minute<=payload.availabilityCutoff)??null:null;
  if(arm==='pcc') return candidates.find((_,index)=>payload[index]?.value===true)??null;
  throw new Error('unknown arm');
}

async function executeCalendar(onboarding,choice,caseId){
  if(!choice) return {success:false,approvals:0,receipt:null};
  const start=new Date(Date.UTC(2026,9,20,0,choice.minute));
  const end=new Date(start.getTime()+30*60*1000);
  const ticket=onboarding.requestAction({
    action:'calendar_create',agent:'scheduler',sink:'calendar',purpose:'schedule approved review',resource:'primary',
    arguments:{summary:`Public review ${caseId}`,start:start.toISOString(),end:end.toISOString(),timeZone:'UTC'}
  });
  if(ticket.decision!=='ask') throw new Error('action did not require approval');
  onboarding.approveAction(ticket.actionId);
  const result=await onboarding.executeAction({actionId:ticket.actionId,agent:'scheduler',sink:'calendar'});
  let replayDenied=false;
  try{await onboarding.executeAction({actionId:ticket.actionId,agent:'scheduler',sink:'calendar'});}catch{replayDenied=true;}
  return {success:result.decision==='allow'&&result.result?.created===true&&replayDenied,approvals:1,receipt:onboarding.actionReceipts().at(-1)};
}

async function pccPayload(record,candidates,caseId){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-pcc-product-'));
  const kernel=new ContextKernel({dir,passphrase:`pcc-product-${caseId}`});
  kernel.put('calendar.privatePolicy',record,{label:'Private scheduling policy',category:'calendar',tags:['calendar','availability']});
  const payload=[],preparations=[],receipts=[];
  for(const [index,candidate] of candidates.entries()){
    const id=`calendar.case-${caseId}.candidate-${index}`;
    kernel.registerConstraintContract({
      id,privateRef:{category:'calendar'},privateField:'availabilityCutoff',extractor:{kind:'number',min:0,max:1439,integer:true},
      release:{op:'compare',label:`Candidate ${index+1} allowed`,operator:'gte',arg:candidate.minute,trueLabel:'yes',falseLabel:'no'}
    });
    const prepared=kernel.prepareConstraintRelease({contractId:id,task:'choose an acceptable public meeting slot',agent:'scheduler',sink:'model.example',purpose:'calendar scheduling'});
    preparations.push(prepared);
    kernel.approveConstraintRelease(prepared.releaseId);
    const released=kernel.consumeConstraintRelease({releaseId:prepared.releaseId,agent:'scheduler',sink:'model.example'});
    payload.push(released.constraint);
    receipts.push(released.receipt);
  }
  fs.rmSync(dir,{recursive:true,force:true});
  return {payload,preparations,receipts,approvals:2};
}

async function main(){
  const arms=['raw','semantic_exact','strict_redaction','pcc'];
  const metrics=Object.fromEntries(arms.map(arm=>[arm,{cases:0,task_success:0,action_success:0,cutoff_disclosures:0,canary_disclosures:0,provider_source_disclosures:0,receipt_disclosures:0,approvals:0,total_latency_ns:0}]));
  const discrete=[];
  const {onboarding,providerCalls}=await actionHarness();
  for(let caseId=0;caseId<256;caseId++){
    const cutoff=120+caseId;
    const canary=`HEALTH_${crypto.createHash('sha256').update(`case-${caseId}`).digest('hex').slice(0,20)}`;
    const record={availabilityCutoff:cutoff,privateNote:canary,ownerEmail:`private-${caseId}@example.invalid`};
    const candidates=[{id:'A',minute:cutoff-15},{id:'B',minute:cutoff+15}];
    for(const arm of arms){
      const before=process.hrtime.bigint();
      let payload,extraApprovals=0,preparations=[],receipts=[];
      if(arm==='raw') payload=structuredClone(record);
      else if(arm==='semantic_exact') payload={availabilityCutoff:cutoff};
      else if(arm==='strict_redaction') payload=sanitizeContextValue(record,{mode:'strict'}).sanitized;
      else ({payload,preparations,receipts,approvals:extraApprovals}=await pccPayload(record,candidates,caseId));
      const choice=modelChoice(arm,payload,candidates);
      const expected=candidates[0];
      const actionStart=providerCalls.length;
      const action=await executeCalendar(onboarding,choice,`${caseId}-${arm}`);
      const newProviderCalls=providerCalls.slice(actionStart);
      const providerView=newProviderCalls.map(call=>({url:call.url,body:call.body}));
      const receiptView={preparations,receipts,action:action.receipt};
      const elapsed=Number(process.hrtime.bigint()-before);
      const metric=metrics[arm];
      metric.cases++;
      metric.task_success+=choice?.id===expected.id;
      metric.action_success+=action.success;
      metric.cutoff_disclosures+=containsExact(payload,cutoff);
      metric.canary_disclosures+=containsExact(payload,canary);
      metric.provider_source_disclosures+=containsExact(providerView,canary)||containsExact(providerView,'availabilityCutoff')||containsExact(providerView,cutoff);
      metric.receipt_disclosures+=containsExact(receiptView,canary)||containsExact(receiptView,'availabilityCutoff')||containsExact(receiptView,cutoff);
      metric.approvals+=extraApprovals+action.approvals;
      metric.total_latency_ns+=elapsed;
      discrete.push({caseId,arm,choice:choice?.id??null,actionSuccess:action.success,modelCutoff:containsExact(payload,cutoff),modelCanary:containsExact(payload,canary),providerSource:containsExact(providerView,canary)||containsExact(providerView,'availabilityCutoff')||containsExact(providerView,cutoff),receiptSource:containsExact(receiptView,canary)||containsExact(receiptView,'availabilityCutoff')||containsExact(receiptView,cutoff)});
    }
  }
  for(const metric of Object.values(metrics)){
    metric.mean_latency_ms=metric.total_latency_ns/metric.cases/1e6;
    delete metric.total_latency_ns;
  }
  const gates={
    utility:['raw','semantic_exact','pcc'].every(arm=>metrics[arm].task_success===256&&metrics[arm].action_success===256),
    strict_below_half:metrics.strict_redaction.task_success<128,
    raw_exposes_both:metrics.raw.cutoff_disclosures===256&&metrics.raw.canary_disclosures===256,
    semantic_exact_boundary:metrics.semantic_exact.cutoff_disclosures===256&&metrics.semantic_exact.canary_disclosures===0,
    pcc_model_non_disclosure:metrics.pcc.cutoff_disclosures===0&&metrics.pcc.canary_disclosures===0,
    pcc_receipt_non_disclosure:metrics.pcc.receipt_disclosures===0,
    provider_minimization:arms.every(arm=>metrics[arm].provider_source_disclosures===0),
    approval_and_one_shot:arms.every(arm=>metrics[arm].action_success===metrics[arm].task_success)
  };
  const result={study:'PCC runtime scheduling product translation',cases:256,metrics,gates,overall:Object.values(gates).every(Boolean)?'PASS':'FAIL',discrete_sha256:crypto.createHash('sha256').update(JSON.stringify(discrete)).digest('hex')};
  const rendered=JSON.stringify(result,null,2)+'\n';
  const outputIndex=process.argv.indexOf('--output');
  if(outputIndex>=0) fs.writeFileSync(process.argv[outputIndex+1],rendered);
  process.stdout.write(rendered);
}

await main();
