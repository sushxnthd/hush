import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateContextRuntime} from '../src/context-runtime.js';
import {TrustRegistry} from '../src/privacy.js';

function runtime(level='limited') {
  let t=1000;
  const trust=new TrustRegistry(level);
  return {r:new PrivateContextRuntime({trustRegistry:trust,now:()=>t++}),trust};
}

function leaseFor(r,{agent='a',purpose='loan',sink='bank',atomId='salary',trajectoryId=null}={}){
  const trajectory=trajectoryId?{trajectoryId}:r.beginTrajectory({purpose});
  const lease=r.issueLease({agent,sink,atomId,trajectoryId:trajectory.trajectoryId});
  return {trajectory,lease};
}

test('context leases expose handles rather than raw values',()=>{
  const {r}=runtime();
  r.put({id:'salary',category:'finance',value:734219});
  const {lease}=leaseFor(r,{});
  assert.match(lease.handle,/^ctx_/);
  assert.equal(JSON.stringify(lease).includes('734219'),false);
});

test('lease is bound to agent sink and runtime-minted trajectory',()=>{
  const {r}=runtime();
  r.put({id:'salary',category:'finance',value:734219});
  const {trajectory,lease}=leaseFor(r,{});
  assert.match(trajectory.trajectoryId,/^traj_/);
  assert.equal(lease.trajectoryId,trajectory.trajectoryId);
  assert.throws(()=>r.query({handle:lease.handle,agent:'b',sink:'bank',op:'gt',arg:500000}),/another agent/);
  assert.throws(()=>r.query({handle:lease.handle,agent:'a',sink:'other',op:'gt',arg:500000}),/another sink/);
});

test('agent cannot reset accounting by supplying a new purpose at query time',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const {trajectory,lease}=leaseFor(r,{purpose:'loan'});
  const q=r.query({handle:lease.handle,agent:'a',sink:'bank',purpose:'pretend-new-purpose',op:'gt',arg:500000});
  assert.equal(q.decision,'allow');
  assert.equal(q.receipt.trajectoryId,trajectory.trajectoryId);
  assert.equal(q.receipt.purpose,'loan');
});

test('repeating the exact same predicate does not spend budget twice',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const {lease}=leaseFor(r,{});
  const a=r.query({handle:lease.handle,agent:'a',sink:'bank',op:'gt',arg:500000});
  const b=r.query({handle:lease.handle,agent:'a',sink:'bank',op:'gt',arg:500000});
  assert.equal(a.decision,'allow');
  assert.equal(b.decision,'allow');
  assert.equal(b.privacy.marginalCost,0);
});

test('distinct predicates on one private atom compose and consume privacy budget',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const {lease}=leaseFor(r,{});
  const costs=[];
  for(const x of [100000,200000,300000]){
    const q=r.query({handle:lease.handle,agent:'a',sink:'bank',op:'gt',arg:x});
    costs.push(q.privacy.marginalCost);
  }
  assert.ok(costs.every(x=>x>0));
});

test('adaptive binary search is cut off before exact reconstruction',()=>{
  const {r}=runtime('standard');
  const secret=734219;
  r.put({id:'salary',category:'finance',value:secret});
  const {lease}=leaseFor(r,{});
  let lo=0,hi=999999,queries=0,blocked=false;
  while(lo<hi && queries<30){
    const mid=Math.floor((lo+hi)/2);
    const q=r.query({handle:lease.handle,agent:'a',sink:'bank',op:'gt',arg:mid});
    queries++;
    if(q.decision!=='allow'){blocked=true;break;}
    if(q.result) lo=mid+1; else hi=mid;
  }
  assert.equal(blocked,true);
  assert.equal(queries,6);
  assert.equal(hi-lo+1,31250);
});

test('sub-agents inherit one trajectory budget instead of receiving fresh budgets',()=>{
  const {r}=runtime('standard');
  r.put({id:'salary',category:'finance',value:734219});
  const trajectory=r.beginTrajectory({purpose:'loan'});
  const a=r.issueLease({agent:'planner',sink:'bank',atomId:'salary',trajectoryId:trajectory.trajectoryId});
  const b=r.issueLease({agent:'checker',sink:'bank',atomId:'salary',trajectoryId:trajectory.trajectoryId});
  const thresholds=[100000,200000,300000,400000,500000];
  for(const x of thresholds){
    const q=r.query({handle:a.handle,agent:'planner',sink:'bank',op:'gt',arg:x});
    assert.equal(q.decision,'allow');
  }
  const delegated=r.query({handle:b.handle,agent:'checker',sink:'bank',op:'gt',arg:600000});
  assert.equal(delegated.decision,'ask');
  assert.equal(delegated.privacy.globalSpent,3.75);
});

test('revoking a trajectory invalidates every lease under it',()=>{
  const {r}=runtime();
  r.put({id:'city',category:'location',value:'Delhi'});
  const trajectory=r.beginTrajectory({purpose:'travel'});
  const a=r.issueLease({agent:'a',sink:'maps',atomId:'city',trajectoryId:trajectory.trajectoryId});
  const b=r.issueLease({agent:'b',sink:'maps',atomId:'city',trajectoryId:trajectory.trajectoryId});
  assert.equal(r.revokeTrajectory(trajectory.trajectoryId),true);
  assert.throws(()=>r.query({handle:a.handle,agent:'a',sink:'maps',op:'exists'}),/trajectory revoked/);
  assert.throws(()=>r.query({handle:b.handle,agent:'b',sink:'maps',op:'exists'}),/trajectory revoked/);
});

test('revoked individual lease cannot be queried',()=>{
  const {r}=runtime();
  r.put({id:'city',category:'location',value:'Delhi'});
  const {lease}=leaseFor(r,{purpose:'travel',sink:'maps',atomId:'city'});
  assert.equal(r.revoke(lease.handle),true);
  assert.throws(()=>r.query({handle:lease.handle,agent:'a',sink:'maps',op:'exists'}),/revoked/);
});
