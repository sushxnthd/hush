import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {sanitizeContextValue} from '../src/context-sanitizer.js';
import {ConsentRegistry} from '../src/consent.js';
import {ActionBroker} from '../src/action-broker.js';
import {createDeviceIdentity,createSyncEnvelope,verifySyncEnvelope} from '../src/sync.js';
import {SealedContextStore} from '../src/secure-context.js';

const PUBLIC_TARGET_SOURCE='https://www.inrupt.com/meet-charlie';
const PASS='charlie parity benchmark passphrase';
const PRIVATE_MARKERS=['1500','ANA','P1234567','aisle','alex@example.com','+1 415 555 0137'];

function temp(prefix='hush-charlie-parity-'){ return fs.mkdtempSync(path.join(os.tmpdir(),prefix)); }
function containsAny(value,markers=PRIVATE_MARKERS){
  const wire=JSON.stringify(value);
  return markers.filter(marker=>wire.includes(marker));
}
function assert(condition,message){ if(!condition) throw new Error(message); }
function timed(fn){
  const start=performance.now();
  return Promise.resolve().then(fn).then(value=>({value,ms:performance.now()-start}));
}

async function runCheck({id,tier,target,run}){
  try{
    const {value,ms}=await timed(run);
    return {id,tier,target,pass:true,ms:Number(ms.toFixed(3)),...value};
  }catch(error){
    return {id,tier,target,pass:false,ms:0,error:error?.message||String(error)};
  }
}

function freshKernel(){ return new ContextKernel({dir:temp(),passphrase:PASS}); }

const checks=[
  {
    id:'connected-user-context',tier:'public-parity',
    target:'Collect and connect important user information behind a user-controlled data boundary.',
    run:()=>{
      const kernel=freshKernel();
      const imported=kernel.ingestConnectorSnapshot({
        provider:'generic',collection:'profile',items:[
          {id:'profile-1',label:'Travel profile',category:'travel',tags:['travel','profile'],value:{passport:'P1234567',home:'Seattle',budget:1500}}
        ]
      });
      const bundle=kernel.exportCiphertextBundle();
      const leak=containsAny(bundle,['P1234567','Seattle','1500','profile-1','Travel profile']);
      assert(imported.received===1&&kernel.stats().connectors.some(x=>x.provider==='generic'&&x.items===1),'connector data was not imported');
      assert(leak.length===0,`ciphertext bundle exposed connector plaintext: ${leak.join(', ')}`);
      return {evidence:{connectorItems:1,ciphertextPlaintextMarkers:leak.length}};
    }
  },
  {
    id:'task-relevant-context',tier:'public-parity',
    target:'Assemble the relevant personal context for a task without handing the model the full profile.',
    run:()=>{
      const kernel=freshKernel();
      kernel.put('travel.maxBudget',1500,{label:'Maximum travel budget',category:'travel',tags:['budget','flight']});
      kernel.put('travel.preferredAirline','ANA',{label:'Preferred airline',category:'travel',tags:['airline','preference']});
      const trajectoryId=kernel.beginTrajectory({purpose:'choose flight',maxBits:3}).trajectoryId;
      const result=kernel.runSemantic({
        trajectoryId,agent:'benchmark-ai',sink:'benchmark',task:'Choose a flight under my travel budget and prefer my usual airline.',
        program:{kind:'choose',candidates:[
          {id:'flight-a',price:1200,airline:'JAL'},
          {id:'flight-b',price:1490,airline:'ANA'},
          {id:'flight-c',price:1800,airline:'ANA'}
        ],constraints:[{op:'candidateLtePrivate',candidate:'price'}],preferences:[
          {kind:'matchPrivate',candidate:'airline',weight:10},
          {kind:'lowerPublic',candidate:'price',scale:1000,weight:0.01}
        ]}
      });
      const leak=containsAny(result,['1500','ANA','travel.maxBudget','travel.preferredAirline']);
      assert(result.decision==='allow'&&result.result==='flight-b','private personalization chose the wrong result');
      assert(leak.length===0,`bounded result leaked private context: ${leak.join(', ')}`);
      return {evidence:{result:result.result,rawPrivateMarkersInResult:leak.length,capacityBits:result.capacityBits??null}};
    }
  },
  {
    id:'best-ai-routing',tier:'public-parity',
    target:'Recommend/select an appropriate AI for each task while accounting for privacy constraints.',
    run:()=>{
      const kernel=freshKernel();
      kernel.registerModel({id:'local-small',provider:'local',locality:'local',trustLevel:'trusted',capabilities:['reasoning'],quality:0.62,latencyMs:300});
      kernel.registerModel({id:'remote-strong',provider:'remote-a',locality:'remote',trustLevel:'standard',capabilities:['reasoning'],quality:0.95,latencyMs:650});
      kernel.registerModel({id:'remote-limited',provider:'remote-b',locality:'remote',trustLevel:'limited',capabilities:['reasoning'],quality:0.99,latencyMs:500});
      const bounded=kernel.routeTask({task:'Reason over a bounded private decision',requiredCapabilities:['reasoning'],privateContext:'bounded',privacyPreference:'balanced'});
      const strict=kernel.routeTask({task:'Use sanitized personal context',requiredCapabilities:['reasoning'],privateContext:'sanitized',privacyPreference:'strict'});
      assert(bounded.decision==='allow'&&bounded.model.id==='remote-strong','bounded routing did not select the strongest eligible model');
      assert(strict.decision==='allow'&&strict.model.id==='local-small','strict sanitized routing did not remain local');
      return {evidence:{boundedModel:bounded.model.id,strictSanitizedModel:strict.model.id}};
    }
  },
  {
    id:'personal-detail-disguise',tier:'public-parity',
    target:'Disguise/minimize personal details before content-bearing context leaves the private boundary.',
    run:()=>{
      const raw={name:'Alex Example',email:'alex@example.com',phone:'+1 415 555 0137',budget:1547,notes:'Meet alex@example.com after the trip.'};
      const out=sanitizeContextValue(raw,{mode:'coarse'});
      const leak=containsAny(out.sanitized,['Alex Example','alex@example.com','+1 415 555 0137','1547']);
      assert(leak.length===0,`sanitized fallback retained direct personal detail: ${leak.join(', ')}`);
      assert(out.requiresApproval===true,'content-bearing fallback must remain approval gated');
      return {evidence:{mode:out.mode,transformations:out.transformations,rawMarkersRemaining:leak.length,requiresApproval:out.requiresApproval}};
    }
  },
  {
    id:'portable-cross-ai-memory',tier:'beyond-public-parity',
    target:'Keep one provider-neutral user memory that can personalize different AIs without copying the memory value into their context.',
    run:()=>{
      const dir=temp();
      let kernel=new ContextKernel({dir,passphrase:PASS});
      const proposal=kernel.proposeMemory({agent:'ai-a',label:'Preferred seat',category:'travel',tags:['seat','preference'],value:'aisle'});
      assert(proposal.decision==='ask','memory proposal should require local approval by default');
      kernel.approveMemoryProposal(proposal.proposalId);
      kernel=new ContextKernel({dir,passphrase:PASS});
      const trajectoryId=kernel.beginTrajectory({purpose:'choose seat',maxBits:2}).trajectoryId;
      const result=kernel.runSemantic({
        trajectoryId,agent:'ai-b',sink:'benchmark',task:'Choose my preferred flight seat.',
        program:{kind:'choose',candidates:[{id:'s1',seat:'window'},{id:'s2',seat:'aisle'}],preferences:[{kind:'matchPrivate',candidate:'seat',privateRef:{query:'preferred seat'},weight:10}]}
      });
      const leak=containsAny(result,['aisle','memory.shared.']);
      assert(result.decision==='allow'&&result.result==='s2','second AI did not receive useful personalization');
      assert(leak.length===0,`shared memory value/path reached second AI result: ${leak.join(', ')}`);
      return {evidence:{writer:'ai-a',reader:'ai-b',selected:'s2',rawMemoryMarkersInResult:leak.length,persistedAcrossRestart:true}};
    }
  },
  {
    id:'user-owned-consent',tier:'beyond-public-parity',
    target:'Make consent portable, explicit, scoped, and enforceable outside any model provider.',
    run:()=>{
      const registry=new ConsentRegistry();
      registry.set({mode:'always',capability:'context.release',agent:'assistant',sink:'planner',purpose:'travel',category:'travel',resource:'Travel profile'});
      registry.set({mode:'never',capability:'context.release',agent:'assistant',sink:'ads',purpose:'*',category:'travel',resource:'Travel profile'});
      const allowed=registry.evaluate({capability:'context.release',agent:'assistant',sink:'planner',purpose:'travel',category:'travel',resource:'Travel profile'});
      const denied=registry.evaluate({capability:'context.release',agent:'assistant',sink:'ads',purpose:'anything',category:'travel',resource:'Travel profile'});
      const unknown=registry.evaluate({capability:'context.release',agent:'other',sink:'planner',purpose:'travel',category:'travel',resource:'Travel profile'});
      assert(allowed.decision==='allow','matching user consent did not allow');
      assert(denied.decision==='deny','explicit never rule did not deny');
      assert(unknown.decision==='ask','unmatched request did not fail to ask');
      return {evidence:{allowed:allowed.decision,denied:denied.decision,unmatched:unknown.decision}};
    }
  },
  {
    id:'secretless-action-authority',tier:'beyond-public-parity',
    target:'Let an AI act with user authority while keeping reusable credentials outside model-visible context.',
    run:async()=>{
      const secret='sk-proj-benchmark-secret-1234567890';
      const consent=new ConsentRegistry();
      consent.set({mode:'always',capability:'action:mail:send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox'});
      let adapterSawSecret=false;
      const broker=new ActionBroker({consentRegistry:consent,secretResolver:async ref=>ref==='mail-credential'?secret:null});
      broker.registerAdapter({name:'mail',actions:['send'],execute:async input=>{
        adapterSawSecret=input.credentials[0]===secret;
        return {sent:true,providerDebug:`authorized with ${input.credentials[0]}`};
      }});
      const ticket=broker.request({adapter:'mail',action:'send',agent:'assistant',sink:'mail',purpose:'send update',category:'communication',resource:'mail:outbox',arguments:{to:'friend@example.com',subject:'Update'},credentialRefs:['mail-credential']});
      const result=await broker.execute({actionId:ticket.actionId,agent:'assistant',sink:'mail'});
      const wire=JSON.stringify(result);
      assert(result.decision==='allow'&&adapterSawSecret,'local adapter did not receive brokered credential');
      assert(!wire.includes(secret)&&result.receipt.rawCredentialIncluded===false,'credential leaked into caller-visible action result');
      return {evidence:{adapterReceivedCredential:true,callerReceivedCredential:false,receiptProduced:true}};
    }
  },
  {
    id:'cumulative-reconstruction-guard',tier:'beyond-public-parity',
    target:'Withhold a highly identifying bounded answer before release when it would reveal too much about private state.',
    run:()=>{
      const kernel=freshKernel();
      kernel.put('finance.balance',734219,{label:'Account balance',category:'finance',tags:['balance'],domain:{type:'integer',min:0,max:999999}});
      const trajectoryId=kernel.beginTrajectory({purpose:'eligibility',maxBits:8,sinkMaxBits:8}).trajectoryId;
      const out=kernel.runSemantic({trajectoryId,agent:'assistant',sink:'benchmark',program:{kind:'predicate',privateRef:{query:'account balance'},op:'eq',value:734219}});
      assert(out.decision==='deny','rare identifying branch was released');
      assert(!Object.hasOwn(out,'result'),'denied private result was included in response');
      assert((out.partition?.marginalKnowledgeBits??0)>19,'privacy guard did not recognize high realized leakage');
      return {evidence:{decision:out.decision,resultReleased:false,marginalKnowledgeBits:out.partition?.marginalKnowledgeBits??null}};
    }
  },
  {
    id:'encrypted-portability-recovery',tier:'beyond-public-parity',
    target:'Move user-owned context between devices and recover it without putting plaintext private data in the sync/recovery layer.',
    run:()=>{
      const dir=temp();
      const store=new SealedContextStore({dir,passphrase:PASS});
      store.put({path:'identity.passport',label:'Passport',category:'identity',value:'P1234567'});
      const bundle=store.exportCiphertextBundle();
      const identity=createDeviceIdentity({label:'Benchmark laptop'});
      const envelope=createSyncEnvelope({bundle,identity,sequence:1,createdAt:Date.now()});
      assert(verifySyncEnvelope(envelope).valid===true,'signed sync envelope did not verify');
      const kit=store.createRecoveryKit('benchmark recovery phrase');
      const publicWire=JSON.stringify({envelope,kit});
      assert(!publicWire.includes('P1234567')&&!publicWire.includes('identity.passport'),'sync/recovery artifact exposed plaintext private state');
      const recovered=SealedContextStore.recoverToDirectory({dir:temp('hush-charlie-recovered-'),recoveryKit:kit,recoveryPhrase:'benchmark recovery phrase',newPassphrase:'replacement local passphrase'});
      assert(recovered.records()[0].value==='P1234567','recovery did not restore private state');
      return {evidence:{signatureVerified:true,plaintextMarkersInTransport:0,recovered:true}};
    }
  }
];

async function main(){
  const results=[];
  for(const check of checks) results.push(await runCheck(check));
  const parity=results.filter(x=>x.tier==='public-parity');
  const beyond=results.filter(x=>x.tier==='beyond-public-parity');

  const rawProfile={budget:1500,preferredAirline:'ANA',passport:'P1234567',seat:'aisle'};
  const directWire=JSON.stringify(rawProfile);
  const directMarkers=PRIVATE_MARKERS.filter(marker=>directWire.includes(marker));
  const boundedCheck=results.find(x=>x.id==='task-relevant-context');

  const report={
    benchmark:'Hush Charlie public-capability parity',
    version:1,
    date:new Date().toISOString(),
    publicTargetSource:PUBLIC_TARGET_SOURCE,
    methodology:'Executable synthetic acceptance tests. Public-parity means Hush demonstrates the same public capability class, not implementation equivalence or a measured head-to-head test of Charlie.',
    summary:{
      passed:results.filter(x=>x.pass).length,
      total:results.length,
      publicParityPassed:parity.filter(x=>x.pass).length,
      publicParityTotal:parity.length,
      beyondParityPassed:beyond.filter(x=>x.pass).length,
      beyondParityTotal:beyond.length,
      allPassed:results.every(x=>x.pass)
    },
    privacyContrast:{
      directProfilePrivateMarkers:directMarkers.length,
      boundedResultPrivateMarkers:boundedCheck?.evidence?.rawPrivateMarkersInResult??null,
      note:'Marker counts are a simple synthetic exposure sanity check, not an information-theoretic privacy metric.'
    },
    results
  };

  if(process.argv.includes('--json')){
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }else{
    console.log('Hush × Charlie public-capability parity benchmark');
    console.log(`Public target: ${PUBLIC_TARGET_SOURCE}`);
    console.log('');
    for(const row of results){
      const mark=row.pass?'PASS':'FAIL';
      console.log(`${mark.padEnd(4)}  ${row.id.padEnd(34)} ${row.ms.toFixed(1).padStart(7)} ms  ${row.target}`);
      if(!row.pass) console.log(`      ${row.error}`);
    }
    console.log('');
    console.log(`Public parity: ${report.summary.publicParityPassed}/${report.summary.publicParityTotal}`);
    console.log(`Beyond-parity defenses: ${report.summary.beyondParityPassed}/${report.summary.beyondParityTotal}`);
    console.log(`Overall: ${report.summary.passed}/${report.summary.total}`);
    console.log(`Synthetic direct-profile private markers: ${report.privacyContrast.directProfilePrivateMarkers}`);
    console.log(`Bounded-result private markers: ${report.privacyContrast.boundedResultPrivateMarkers}`);
    if(!report.summary.allPassed) process.exitCode=1;
  }
}

await main();
