import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../../src/action-broker.js';
import {certifyLifecycleTraceAuthorization,payloadOnlyLifecycleSafe} from '../../src/lifecycle-trace-contract.js';
import {canonicalize} from '../../src/core.js';

const output=process.argv[2];
if(!output) throw new Error('output path required');
const worlds=['00','01','10','11'];
const parity=Object.fromEntries(worlds.map(w=>[w,Number(w[0])^Number(w[1])]));
const alphabet=[null,0,1];

function assignments(){
  const out=[];
  for(const a of alphabet)for(const b of alphabet)for(const c of alphabet)for(const d of alphabet){
    const traces={'00':[a],'01':[b],'10':[c],'11':[d]};
    if(payloadOnlyLifecycleSafe({worlds,globalAuthorization:parity,traces})) out.push([a,b,c,d]);
  }
  return out;
}
const slotMaps=assignments();
const enumeration=[];
let firstFalseAccept=null;
for(let phases=1;phases<=3;phases+=1){
  let candidates=0,safe=0,oracleDisagreements=0;
  const chosen=[];
  function visit(depth){
    if(depth<phases){ for(const map of slotMaps){chosen.push(map);visit(depth+1);chosen.pop();} return; }
    candidates+=1;
    const traces=Object.fromEntries(worlds.map((world,index)=>[world,chosen.map(map=>map[index])]));
    const certified=certifyLifecycleTraceAuthorization({worlds,globalAuthorization:parity,traces}).safe;
    const oracle=(JSON.stringify(traces['00'])===JSON.stringify(traces['11'])&&JSON.stringify(traces['01'])===JSON.stringify(traces['10']));
    if(certified) safe+=1;
    if(certified!==oracle) oracleDisagreements+=1;
    if(!certified&&!firstFalseAccept) firstFalseAccept={phases,traces};
  }
  visit(0);
  enumeration.push({phases,candidates,safe,payloadOnlyFalseAccepts:candidates-safe,oracleDisagreements});
}

const same=value=>Object.fromEntries(worlds.map(world=>[world,value]));
const traces={
  existence:{'00':[null],'11':['constant'],'01':[null],'10':[null]},
  terminal:{'00':['terminal:allow'],'11':['terminal:error'],'01':['terminal:allow'],'10':['terminal:allow']},
  cancellation:{'00':['terminal:complete'],'11':['terminal:cancelled'],'01':['terminal:complete'],'10':['terminal:complete']},
  race:{'00':['cancel','error'],'11':['error','cancel'],'01':['cancel','error'],'10':['cancel','error']},
  crashRecovery:{'00':[null],'11':['recovered'],'01':[null],'10':[null]},
  safe:{'00':['terminal:complete'],'11':['terminal:complete'],'01':['terminal:error'],'10':['terminal:error']}
};

function brokerFor({traceMap,dispatches,resolutions,stateStore}={}){
  const broker=new ActionBroker({authorizationStateStore:stateStore,secretResolver:async ref=>{resolutions.push(ref);return 'secret';}});
  broker.registerAdapter({name:'lifecycle',actions:['run'],authorizationScopes:{run:parity},lifecycleTraces:traceMap?{run:traceMap}:{},execute:async()=>{dispatches.push('run');return {value:'constant'};}});
  return broker;
}
async function exercise(name,traceMap,{restart=false,missing=false}={}){
  const dispatches=[],resolutions=[];
  let broker;
  let dir=null;
  if(restart){
    dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-lifecycle-'));
    const store=new EncryptedAuthorizationStateStore({file:path.join(dir,'state.enc.json'),key:crypto.createHash('sha256').update('lifecycle-fixed-key').digest()});
    const writer=brokerFor({traceMap,dispatches:[],resolutions:[],stateStore:store});
    writer.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
    broker=brokerFor({traceMap,dispatches,resolutions,stateStore:store});
  }else{
    broker=brokerFor({traceMap:missing?null:traceMap,dispatches,resolutions});
    broker.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
  }
  const request=broker.request({adapter:'lifecycle',action:'run',transactionId:'tx',agent:'probe',sink:'local',credentialRefs:['cred'],requireLifecycleTraceCertificate:true});
  broker.approve(request.actionId);
  const result=await broker.execute({actionId:request.actionId,agent:'probe',sink:'local'});
  if(dir) fs.rmSync(dir,{recursive:true,force:true});
  return {name,requestDecision:request.lifecycleTraceDecision??null,decision:result.decision,reason:result.reason??null,dispatches:dispatches.length,credentialResolutions:resolutions.length,receiptStatus:result.receipt?.status??null};
}

const scenarios=[];
scenarios.push(await exercise('secret_dependent_existence',traces.existence));
scenarios.push(await exercise('secret_dependent_terminal',traces.terminal));
scenarios.push(await exercise('secret_dependent_cancellation',traces.cancellation));
scenarios.push(await exercise('secret_dependent_race_order',traces.race));
scenarios.push(await exercise('secret_dependent_crash_recovery',traces.crashRecovery,{restart:true}));
scenarios.push(await exercise('authorization_factored_trace',traces.safe));
scenarios.push(await exercise('missing_required_declaration',null,{missing:true}));

const legacyDispatches=[];
const legacyA=brokerFor({traceMap:null,dispatches:legacyDispatches,resolutions:[]});
const legacyB=brokerFor({traceMap:traces.existence,dispatches:legacyDispatches,resolutions:[]});
legacyA.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
legacyB.registerAuthorizationTransaction({transactionId:'tx',worlds,globalAuthorization:parity});
const legacyReqA=legacyA.request({adapter:'lifecycle',action:'run',transactionId:'tx',agent:'probe',sink:'local'});
const legacyReqB=legacyB.request({adapter:'lifecycle',action:'run',transactionId:'tx',agent:'probe',sink:'local'});
legacyA.approve(legacyReqA.actionId);legacyB.approve(legacyReqB.actionId);
const legacyResultA=await legacyA.execute({actionId:legacyReqA.actionId,agent:'probe',sink:'local'});
const legacyResultB=await legacyB.execute({actionId:legacyReqB.actionId,agent:'probe',sink:'local'});
scenarios.push({name:'legacy_opt_out_unchanged',requestHashEqual:legacyReqA.requestHash===legacyReqB.requestHash,decisionA:legacyResultA.decision,decisionB:legacyResultB.decision,dispatches:legacyDispatches.length});

const totals=enumeration.reduce((a,row)=>({candidates:a.candidates+row.candidates,safe:a.safe+row.safe,falseAccepts:a.falseAccepts+row.payloadOnlyFalseAccepts,oracleDisagreements:a.oracleDisagreements+row.oracleDisagreements}),{candidates:0,safe:0,falseAccepts:0,oracleDisagreements:0});
const denied=scenarios.slice(0,5).every(row=>row.decision==='deny'&&row.dispatches===0&&row.credentialResolutions===0);
const safe=scenarios[5].decision==='allow'&&scenarios[5].dispatches===1&&scenarios[5].credentialResolutions===1;
const missing=scenarios[6].decision==='deny'&&scenarios[6].dispatches===0&&scenarios[6].credentialResolutions===0;
const legacy=scenarios[7].requestHashEqual&&scenarios[7].decisionA==='allow'&&scenarios[7].decisionB==='allow'&&scenarios[7].dispatches===2;
const gates={exactCounts:totals.candidates===120099&&totals.safe===819&&totals.falseAccepts===119280,zeroOracleDisagreements:totals.oracleDisagreements===0,unsafeDeniedBeforeCredentialsOrDispatch:denied,safeControlAllowed:safe,missingDeclarationFailsClosed:missing,legacyOptOutUnchanged:legacy};
const payload={schema:'hush.lifecycle-absence-factorization.v1',classification:'EXACT_THEOREM_AND_PROSPECTIVE_RUNTIME',frozen:{worlds,globalAuthorization:'parity',alphabet:['BOTTOM',0,1],phaseCounts:[1,2,3]},enumeration,totals,firstPayloadOnlyFalseAccept:firstFalseAccept,scenarios,gates,status:Object.values(gates).every(Boolean)?'PASS':'FAIL'};
const canonical=canonicalize(payload);
payload.resultDigest=crypto.createHash('sha256').update(canonical).digest('hex');
fs.writeFileSync(output,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify({status:payload.status,totals,gates,resultDigest:payload.resultDigest},null,2));
