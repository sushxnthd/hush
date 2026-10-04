import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {PersistentReconstructionFirewall} from '../src/reconstruction-firewall.js';

function runtime(fieldBudgetBits=3,audienceBudgetBits=3){
  let now=1000;
  const firewall=new PersistentReconstructionFirewall({now:()=>now++,fieldBudgetBits,audienceBudgetBits});
  const r=new PrivateDecisionRuntime({now:()=>now++,firewall});
  r.setPrivate('finance.balance',734219);
  return {r,firewall};
}

function ask(r,threshold,sink='bank.example'){
  const t=r.beginTrajectory({purpose:`eligibility-${threshold}`,maxBits:1,sinkMaxBits:1});
  return r.run({trajectoryId:t.trajectoryId,agent:`agent-${threshold}`,sink,program:{kind:'predicate',private:'finance.balance',op:'gt',value:threshold}});
}

test('fresh trajectories cannot reset reconstruction budget',()=>{
  const {r,firewall}=runtime(3,3);
  assert.equal(ask(r,500000).decision,'allow');
  assert.equal(ask(r,700000).decision,'allow');
  assert.equal(ask(r,750000).decision,'allow');
  const blocked=ask(r,725000);
  assert.equal(blocked.decision,'deny');
  assert.match(blocked.reason,/Persistent reconstruction budget/);
  assert.equal(firewall.footprint()[0].spentBits,3);
});

test('rotating agents and sinks cannot evade global field budget',()=>{
  const {r}=runtime(2,2);
  assert.equal(ask(r,500000,'sink-a').decision,'allow');
  assert.equal(ask(r,700000,'sink-b').decision,'allow');
  const blocked=ask(r,750000,'sink-c');
  assert.equal(blocked.decision,'deny');
  assert.equal(blocked.reconstruction.fields[0].fieldSpentBits,2);
});

test('same deterministic query is globally free but new audience is separately accounted',()=>{
  const {r,firewall}=runtime(2,1);
  const a=ask(r,500000,'sink-a');
  const repeat=ask(r,500000,'sink-a');
  const other=ask(r,500000,'sink-b');
  assert.equal(a.decision,'allow');
  assert.equal(repeat.decision,'allow');
  assert.equal(repeat.reconstruction.fields[0].repeatForAudience,true);
  assert.equal(other.decision,'allow');
  assert.equal(other.reconstruction.fields[0].repeatGlobally,true);
  assert.equal(other.reconstruction.fields[0].repeatForAudience,false);
  const fp=firewall.footprint()[0];
  assert.equal(fp.spentBits,1);
  assert.equal(fp.audiences.length,2);
});

test('firewall state can be snapshotted and restored',()=>{
  const {r,firewall}=runtime(1,1);
  assert.equal(ask(r,500000).decision,'allow');
  let restoredNow=2000;
  const restored=new PersistentReconstructionFirewall({now:()=>restoredNow++,fieldBudgetBits:1,audienceBudgetBits:1}).restore(firewall.snapshot());
  const r2=new PrivateDecisionRuntime({now:()=>restoredNow++,firewall:restored});
  r2.setPrivate('finance.balance',734219);
  const t=r2.beginTrajectory({purpose:'new-task',maxBits:1,sinkMaxBits:1});
  const out=r2.run({trajectoryId:t.trajectoryId,agent:'new-agent',sink:'bank.example',program:{kind:'predicate',private:'finance.balance',op:'gt',value:700000}});
  assert.equal(out.decision,'deny');
});
