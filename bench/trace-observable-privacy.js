/*
 * Trace-Observable Privacy (TOP) prototype.
 *
 * This is a research benchmark, not production policy. It tests whether a
 * secret-dependent action can be kept out of a model-visible trace by moving
 * action selection into a trusted local executor behind an opaque plan.
 */

const DOMAIN = Object.freeze(Array.from({length:16},(_,i)=>i));
const ACTIONS = Object.freeze(DOMAIN.map(secret=>({id:`route-${String(secret).padStart(2,'0')}`,utilityClass:'same-task'})));

function choosePrivateAction(secret){
  const action=ACTIONS[Number(secret)];
  if(!action) throw new Error('Secret is outside the benchmark domain');
  return action.id;
}

function traceKey(trace){ return JSON.stringify(trace); }

function exactTracePartition(traceForSecret){
  const groups=new Map();
  for(const secret of DOMAIN){
    const key=traceKey(traceForSecret(secret));
    const list=groups.get(key)??[];
    list.push(secret);
    groups.set(key,list);
  }
  return [...groups.values()];
}

function realizedLeakageBits(traceForSecret){
  const groups=new Map();
  for(const secret of DOMAIN){
    const key=traceKey(traceForSecret(secret));
    const list=groups.get(key)??[];
    list.push(secret);
    groups.set(key,list);
  }
  return DOMAIN.map(secret=>{
    const key=traceKey(traceForSecret(secret));
    const remaining=groups.get(key).length;
    return Math.log2(DOMAIN.length/remaining);
  });
}

function summarizeTrace(traceForSecret){
  const partitions=exactTracePartition(traceForSecret);
  const bits=realizedLeakageBits(traceForSecret);
  return {
    partitions:partitions.length,
    largestPosteriorClass:Math.max(...partitions.map(group=>group.length)),
    minimumRemainingCandidates:Math.min(...partitions.map(group=>group.length)),
    maximumRealizedLeakageBits:Math.max(...bits),
    meanRealizedLeakageBits:bits.reduce((sum,value)=>sum+value,0)/bits.length
  };
}

function naiveModelTrace(secret){
  // The model-visible tool trace contains the secret-dependent action id.
  return {event:'tool_call',tool:'provider.route',arguments:{action:choosePrivateAction(secret)}};
}

function opaqueModelTrace(){
  // Every secret produces the same model-visible trace.
  return {event:'hush_plan',plan:'opaque:route-plan-v1',decision:'allow',result:'queued'};
}

function opaqueProviderTrace(secret){
  // The provider may observe the action it is asked to execute. This is not
  // claimed private from that provider; it is intentionally sink-localized.
  return {event:'provider_action',action:choosePrivateAction(secret)};
}

function deniedModelTrace(){
  return {event:'hush_plan',decision:'deny',reason:'secret-dependent action is not safe for a model-visible sink'};
}

function assert(condition,message){
  if(!condition) throw new Error(message);
}

const naive=summarizeTrace(naiveModelTrace);
const opaque=summarizeTrace(opaqueModelTrace);
const provider=summarizeTrace(opaqueProviderTrace);
const denied=summarizeTrace(deniedModelTrace);

// A naive injective action trace reveals the complete 4-bit secret.
assert(naive.maximumRealizedLeakageBits===4,'naive action trace should reveal all four secret bits');
// The opaque plan is constant across the private domain.
assert(opaque.maximumRealizedLeakageBits===0&&opaque.partitions===1,'opaque model trace must reveal zero bits');
// The provider-side action remains observable, so the result does not overclaim.
assert(provider.maximumRealizedLeakageBits===4,'provider trace should retain its intentional observability');
// Denial also reveals no secret but does not preserve task utility.
assert(denied.maximumRealizedLeakageBits===0,'denied trace must reveal zero bits');

const report={
  benchmark:'Hush Trace-Observable Privacy prototype',
  version:1,
  domainSize:DOMAIN.length,
  secretBits:Math.log2(DOMAIN.length),
  utility:{
    naive:1,
    opaqueLocalExecutor:1,
    deniedModelVisibleAction:0
  },
  traces:{
    naiveModelVisible:naive,
    opaqueModelVisible:opaque,
    opaqueProviderSink:provider,
    deniedModelVisibleAction:denied
  },
  interpretation:{
    result:'A constant opaque model trace preserves task utility while relocating secret-dependent action choice to the trusted local executor.',
    boundary:'The external provider sink still observes the action. Hush must therefore scope privacy claims to named sinks and observables.',
    status:'synthetic prototype; not an independent or production security result'
  }
};

if(process.argv.includes('--json')) process.stdout.write(JSON.stringify(report,null,2)+'\n');
else{
  console.log('Hush Trace-Observable Privacy prototype');
  console.log(`Domain: ${report.domainSize} secrets (${report.secretBits} bits)`);
  console.log(`Naive model trace: ${naive.maximumRealizedLeakageBits} bits; utility 100%`);
  console.log(`Opaque model trace: ${opaque.maximumRealizedLeakageBits} bits; utility 100%`);
  console.log(`Provider sink trace: ${provider.maximumRealizedLeakageBits} bits; intentionally observable`);
  console.log(`Denied model-visible action: ${denied.maximumRealizedLeakageBits} bits; utility 0%`);
}
