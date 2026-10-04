import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateDecisionRuntime, capacityBits} from '../src/private-decision.js';

function travelRuntime(maxBits=8){
  let now=1000;
  const r=new PrivateDecisionRuntime({now:()=>now++});
  r.setPrivate('travel.maxBudget',1500);
  r.setPrivate('travel.preferredAirline','ANA');
  r.setPrivate('travel.preferredDepartureHour',10);
  return {r,trajectory:r.beginTrajectory({purpose:'book a flight',maxBits,sinkMaxBits:maxBits})};
}

const flights=[
  {id:'flight-a',price:1300,airline:'JAL',departureHour:9},
  {id:'flight-b',price:1490,airline:'ANA',departureHour:11},
  {id:'flight-c',price:1800,airline:'ANA',departureHour:10}
];

const chooseFlight={
  kind:'choose',
  candidates:flights,
  constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.maxBudget'}],
  preferences:[
    {kind:'matchPrivate',candidate:'airline',private:'travel.preferredAirline',weight:10},
    {kind:'nearPrivate',candidate:'departureHour',private:'travel.preferredDepartureHour',weight:2,scale:1},
    {kind:'lowerPublic',candidate:'price',weight:0.1,scale:100}
  ]
};

test('capacity bound is log2 of explicit output cardinality',()=>{
  assert.equal(capacityBits(2),1);
  assert.equal(capacityBits(4),2);
  assert.equal(capacityBits(8),3);
});

test('blind personalization chooses using private state without returning the profile',()=>{
  const {r,trajectory}=travelRuntime();
  const out=r.run({trajectoryId:trajectory.trajectoryId,agent:'travel-agent',sink:'travel.example',program:chooseFlight});
  assert.equal(out.decision,'allow');
  assert.equal(out.result,'flight-b');
  assert.equal(out.receipt.privateValuesIncluded,false);
  assert.equal(JSON.stringify(out).includes('1500'),false);
  assert.equal(out.capacity.cardinality,4); // 3 candidate ids + null
  assert.equal(out.capacity.marginalBits,2);
});

test('repeating identical private decision at same profile revision is free',()=>{
  const {r,trajectory}=travelRuntime();
  const a=r.run({trajectoryId:trajectory.trajectoryId,agent:'a',sink:'travel.example',program:chooseFlight});
  const b=r.run({trajectoryId:trajectory.trajectoryId,agent:'a',sink:'travel.example',program:chooseFlight});
  assert.equal(a.capacity.marginalBits,2);
  assert.equal(b.capacity.marginalBits,0);
  assert.equal(b.capacity.repeat,true);
});

test('different agents share one explicit information budget',()=>{
  const {r,trajectory}=travelRuntime(3);
  const first=r.run({trajectoryId:trajectory.trajectoryId,agent:'planner',sink:'travel.example',program:chooseFlight});
  assert.equal(first.decision,'allow');
  const secondProgram={...chooseFlight,candidates:flights.map(x=>({...x,price:x.price+1}))};
  const second=r.run({trajectoryId:trajectory.trajectoryId,agent:'checker',sink:'travel.example',program:secondProgram});
  assert.equal(second.decision,'deny');
  assert.equal(second.capacity.spentBits,2);
});

test('profile changes make an old query informative again',()=>{
  const {r,trajectory}=travelRuntime(3);
  const first=r.run({trajectoryId:trajectory.trajectoryId,agent:'a',sink:'travel.example',program:chooseFlight});
  assert.equal(first.decision,'allow');
  r.setPrivate('travel.maxBudget',1400);
  const second=r.run({trajectoryId:trajectory.trajectoryId,agent:'a',sink:'travel.example',program:chooseFlight});
  assert.equal(second.decision,'deny');
  assert.equal(second.capacity.marginalBits,2);
});

test('predicate programs consume at most one explicit bit each',()=>{
  const r=new PrivateDecisionRuntime();
  r.setPrivate('finance.balance',734219);
  const t=r.beginTrajectory({purpose:'eligibility',maxBits:2,sinkMaxBits:2});
  const q1=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'gt',value:500000}});
  const q2=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'gt',value:700000}});
  const q3=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'predicate',private:'finance.balance',op:'gt',value:750000}});
  assert.equal(q1.decision,'allow');
  assert.equal(q2.decision,'allow');
  assert.equal(q3.decision,'deny');
  assert.equal(q2.capacity.spentBits,2);
});

test('bucket output is charged by its number of possible buckets',()=>{
  const r=new PrivateDecisionRuntime();
  r.setPrivate('finance.balance',734219);
  const t=r.beginTrajectory({purpose:'coarse eligibility',maxBits:2,sinkMaxBits:2});
  const out=r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'bank',program:{kind:'bucket',private:'finance.balance',thresholds:[250000,500000,750000]}});
  assert.equal(out.decision,'allow');
  assert.equal(out.result,2);
  assert.equal(out.capacity.cardinality,4);
  assert.equal(out.capacity.marginalBits,2);
});

test('raw/exact private output is not part of the decision language',()=>{
  const r=new PrivateDecisionRuntime();
  r.setPrivate('identity.passport','P1234567');
  const t=r.beginTrajectory({purpose:'travel'});
  assert.throws(()=>r.run({trajectoryId:t.trajectoryId,agent:'a',sink:'travel.example',program:{kind:'exact',private:'identity.passport'}}),/Unsupported private decision program/);
});
