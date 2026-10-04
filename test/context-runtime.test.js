import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateContextRuntime} from '../src/context-runtime.js';
import {TrustRegistry} from '../src/privacy.js';

function runtime(level='limited') {
  let t=1000;
  const trust=new TrustRegistry(level);
  return {r:new PrivateContextRuntime({trustRegistry:trust,now:()=>t++}),trust};
}

test('context leases expose handles rather than raw values',()=>{
  const {r}=runtime();
  r.put({id:'salary',category:'finance',value:734219});
  const lease=r.issueLease({agent:'a',purpose:'loan',sink:'bank',atomId:'salary'});
  assert.match(lease.handle,/^ctx_/);
  assert.equal(JSON.stringify(lease).includes('734219'),false);
});

test('lease is bound to agent purpose and sink',()=>{
  const {r}=runtime();
  r.put({id:'salary',category:'finance',value:734219});
  const lease=r.issueLease({agent:'a',purpose:'loan',sink:'bank',atomId:'salary'});
  assert.throws(()=>r.query({handle:lease.handle,agent:'b',purpose:'loan',sink:'bank',op:'gt',arg:500000}),/another agent/);
  assert.throws(()=>r.query({handle:lease.handle,agent:'a',purpose:'other',sink:'bank',op:'gt',arg:500000}),/another purpose/);
  assert.throws(()=>r.query({handle:lease.handle,agent:'a',purpose:'loan',sink:'other',op:'gt',arg:500000}),/another sink/);
});

test('repeating the exact same predicate does not spend budget twice',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const l=r.issueLease({agent:'a',purpose:'loan',sink:'bank',atomId:'salary'});
  const a=r.query({handle:l.handle,agent:'a',purpose:'loan',sink:'bank',op:'gt',arg:500000});
  const b=r.query({handle:l.handle,agent:'a',purpose:'loan',sink:'bank',op:'gt',arg:500000});
  assert.equal(a.decision,'allow');
  assert.equal(b.decision,'allow');
  assert.equal(b.privacy.marginalCost,0);
});

test('distinct predicates on one private atom compose and consume privacy budget',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const l=r.issueLease({agent:'a',purpose:'loan',sink:'bank',atomId:'salary'});
  const costs=[];
  for(const x of [100000,200000,300000]){
    const q=r.query({handle:l.handle,agent:'a',purpose:'loan',sink:'bank',op:'gt',arg:x});
    costs.push(q.privacy.marginalCost);
  }
  assert.ok(costs.every(x=>x>0));
});

test('adaptive binary search is cut off before exact reconstruction',()=>{
  const {r}=runtime('standard');
  const secret=734219;
  r.put({id:'salary',category:'finance',value:secret});
  const l=r.issueLease({agent:'a',purpose:'loan',sink:'bank',atomId:'salary'});
  let lo=0,hi=999999,queries=0,blocked=false;
  while(lo<hi && queries<30){
    const mid=Math.floor((lo+hi)/2);
    const q=r.query({handle:l.handle,agent:'a',purpose:'loan',sink:'bank',op:'gt',arg:mid});
    queries++;
    if(q.decision!=='allow'){blocked=true;break;}
    if(q.result) lo=mid+1; else hi=mid;
  }
  assert.equal(blocked,true);
  assert.equal(queries,6);
  assert.equal(hi-lo+1,31250);
});

test('revoked lease cannot be queried',()=>{
  const {r}=runtime();
  r.put({id:'city',category:'location',value:'Delhi'});
  const l=r.issueLease({agent:'a',purpose:'travel',sink:'maps',atomId:'city'});
  assert.equal(r.revoke(l.handle),true);
  assert.throws(()=>r.query({handle:l.handle,agent:'a',purpose:'travel',sink:'maps',op:'exists'}),/revoked/);
});
