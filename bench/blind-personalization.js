import {PrivateDecisionRuntime} from '../src/private-decision.js';

const runtime=new PrivateDecisionRuntime();

// These values are intentionally never printed. They stand in for local personal
// context that a conventional personalized agent might place in model context.
runtime.setPrivate('travel.maxBudget',1200);
runtime.setPrivate('travel.preferredAirline','ANA');
runtime.setPrivate('travel.preferredDepartureHour',10);

const candidates=Array.from({length:15},(_,i)=>({
  id:`flight-${String(i+1).padStart(2,'0')}`,
  price:850+(i*47)%520,
  airline:i%3===1?'ANA':i%3===2?'JAL':'United',
  departureHour:6+(i*3)%17
}));

const program={
  kind:'choose',
  candidates,
  constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.maxBudget'}],
  preferences:[
    {kind:'matchPrivate',candidate:'airline',private:'travel.preferredAirline',weight:10},
    {kind:'nearPrivate',candidate:'departureHour',private:'travel.preferredDepartureHour',weight:3,scale:1},
    {kind:'lowerPublic',candidate:'price',weight:0.2,scale:100}
  ]
};

const trajectory=runtime.beginTrajectory({purpose:'book a flight',maxBits:4,sinkMaxBits:4});
const first=runtime.run({trajectoryId:trajectory.trajectoryId,agent:'travel-agent',sink:'travel.example',program});

const changed={...program,candidates:candidates.map((c,i)=>({...c,price:c.price+(i%2)}))};
const second=runtime.run({trajectoryId:trajectory.trajectoryId,agent:'travel-agent',sink:'travel.example',program:changed});

console.log(JSON.stringify({
  benchmark:'blind personalization',
  statement:'The agent supplies public candidates; Supakeep chooses locally using private context and returns only a bounded result.',
  publicCandidates:candidates.length,
  privateFieldsUsed:['travel.maxBudget','travel.preferredAirline','travel.preferredDepartureHour'],
  rawPrivateValuesReturned:0,
  firstDecision:{
    decision:first.decision,
    selectedCandidate:first.result,
    explicitOutputCardinality:first.capacity?.cardinality,
    worstCaseExplicitLeakageBits:first.capacity?.marginalBits
  },
  secondDistinctDecision:{
    decision:second.decision,
    reason:second.reason,
    marginalBitsRequested:second.capacity?.marginalBits,
    trajectoryBitsAlreadySpent:second.capacity?.spentBits,
    trajectoryBitBudget:second.capacity?.maxBits
  },
  caveat:'The bit bound covers the controlled explicit return channel only, not timing, crashes, side effects, or data released outside Supakeep.'
},null,2));
