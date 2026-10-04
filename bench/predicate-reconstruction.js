import {DisclosureLedger, TrustRegistry} from '../src/privacy.js';
import {PrivateContextRuntime} from '../src/context-runtime.js';

const SECRET=734219;
const MIN=0,MAX=999999;

function binarySearch(answer){
  let lo=MIN,hi=MAX,queries=0;
  while(lo<hi && queries<64){
    const mid=Math.floor((lo+hi)/2);
    const q=answer(mid);
    queries++;
    if(q.blocked) return {recovered:false,queries,remaining:hi-lo+1,lo,hi};
    if(q.value) lo=mid+1; else hi=mid;
  }
  return {recovered:lo===SECRET,queries,remaining:hi-lo+1,lo,hi};
}

const unrestricted=binarySearch(mid=>({value:SECRET>mid,blocked:false}));

const trustA=new TrustRegistry('standard');
const ledgerA=new DisclosureLedger({trustRegistry:trustA,windowMs:999999999});
let tA=1000;
const atomLevel=binarySearch(mid=>{
  const req={agent:'agent',purpose:'loan',sink:'bank',category:'finance',level:'boolean',atomId:'salary'};
  const e=ledgerA.evaluate(req,tA++);
  if(e.decision==='deny') return {blocked:true};
  ledgerA.record(req,e,tA++);
  return {value:SECRET>mid,blocked:false};
});

let tB=1000;
const trustB=new TrustRegistry('standard');
const runtime=new PrivateContextRuntime({trustRegistry:trustB,now:()=>tB++});
runtime.put({id:'salary',category:'finance',value:SECRET});
const lease=runtime.issueLease({agent:'agent',purpose:'loan',sink:'bank',atomId:'salary'});
const compositional=binarySearch(mid=>{
  const q=runtime.query({handle:lease.handle,agent:'agent',purpose:'loan',sink:'bank',op:'gt',arg:mid});
  return q.decision==='allow'?{value:q.result,blocked:false}:{blocked:true};
});

console.log(JSON.stringify({
  benchmark:'adaptive predicate reconstruction',
  secretDomain:`${MIN}..${MAX}`,
  note:'Synthetic attack. It demonstrates query-composition behavior, not a universal privacy guarantee.',
  results:{
    unrestrictedPredicateOracle:unrestricted,
    perAtomBooleanAccounting:atomLevel,
    supakeepCompositionalAccounting:compositional
  }
},null,2));
