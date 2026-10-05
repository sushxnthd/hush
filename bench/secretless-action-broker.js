import {ActionBroker} from '../src/action-broker.js';

const TRIALS=200;
const SECRET='sk_live_HUSH_BENCHMARK_SECRET_7mQ9x2';
const HANDLE='cred://payments/default';

function naiveAction({secret,amount,recipient}){
  // Representative direct tool path: the model/tool request contains the live
  // credential because the tool itself needs it to execute.
  const modelVisible={action:'pay',arguments:{amount,recipient,apiKey:secret}};
  const success=modelVisible.arguments.apiKey===secret;
  return {success,modelVisible,credentialExposed:JSON.stringify(modelVisible).includes(secret)};
}

async function hushAction({amount,recipient,reflectSecret=false}){
  const broker=new ActionBroker({secretResolver:async ref=>{
    if(ref!==HANDLE) throw new Error('Unknown credential handle');
    return SECRET;
  }});
  broker.registerAdapter({
    name:'payments',actions:['pay'],
    execute:async ({arguments:args,credentials})=>{
      const authorized=credentials[0]===SECRET;
      if(!authorized) throw new Error('Unauthorized');
      return {
        ok:true,
        recipient:args.recipient,
        amount:args.amount,
        providerMessage:reflectSecret?`authorized with ${credentials[0]}`:'authorized'
      };
    }
  });
  const requested=broker.request({
    adapter:'payments',action:'pay',agent:'benchmark-agent',sink:'payments.example',
    purpose:'execute user-approved payment',category:'financial',resource:'payment',
    arguments:{amount,recipient},credentialRefs:[HANDLE]
  });
  if(requested.decision==='deny') return {success:false,requested};
  broker.approve(requested.actionId);
  const executed=await broker.execute({actionId:requested.actionId,agent:'benchmark-agent',sink:'payments.example'});
  const modelSurface={requested,executed};
  return {
    success:executed.decision==='allow'&&executed.result?.ok===true,
    modelSurface,
    credentialExposed:JSON.stringify(modelSurface).includes(SECRET),
    handleVisible:JSON.stringify(modelSurface).includes(HANDLE),
    receiptRawCredentialIncluded:executed.receipt?.rawCredentialIncluded,
    reflectedSecretScrubbed:reflectSecret?executed.result?.providerMessage?.includes('[HUSH:CREDENTIAL]')===true:true
  };
}

let naiveSuccess=0,naiveExposure=0,hushSuccess=0,hushExposure=0,hushScrubbed=0;
for(let i=0;i<TRIALS;i++){
  const amount=10+(i%91);
  const recipient=`recipient-${i%17}`;
  const naive=naiveAction({secret:SECRET,amount,recipient});
  if(naive.success) naiveSuccess++;
  if(naive.credentialExposed) naiveExposure++;
  const hush=await hushAction({amount,recipient,reflectSecret:i%2===0});
  if(hush.success) hushSuccess++;
  if(hush.credentialExposed) hushExposure++;
  if(hush.reflectedSecretScrubbed) hushScrubbed++;
  if(hush.receiptRawCredentialIncluded!==false) throw new Error('Hush receipt must assert rawCredentialIncluded=false');
}

const report={
  trials:TRIALS,
  naive:{successRate:naiveSuccess/TRIALS,credentialExposureRate:naiveExposure/TRIALS},
  hush:{successRate:hushSuccess/TRIALS,credentialExposureRate:hushExposure/TRIALS,reflectionScrubRate:hushScrubbed/TRIALS}
};
console.log('\nSecretless action brokerage benchmark');
console.table(report);

if(report.naive.successRate!==1) throw new Error('Naive comparator must complete all benchmark actions');
if(report.naive.credentialExposureRate!==1) throw new Error('Naive comparator should expose its credential on every direct-tool request');
if(report.hush.successRate!==1) throw new Error('Hush must preserve action success in every benchmark trial');
if(report.hush.credentialExposureRate!==0) throw new Error('Hush model-facing surface exposed the raw credential');
if(report.hush.reflectionScrubRate!==1) throw new Error('Hush failed to scrub credential reflection from adapter output');

console.log(`Hush completed ${hushSuccess}/${TRIALS} actions with 0 raw credential exposures on the model-facing surface.`);
