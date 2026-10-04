import {performance} from 'node:perf_hooks';
import {PrivateDecisionRuntime} from '../src/private-decision.js';

function rareBitsProgram(width){
  const rare={id:'rare',penalty:width-0.5};
  const fallback={id:'fallback',penalty:0};
  const preferences=[];
  for(let i=0;i<width;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'penalty',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function run(width,value){
  const runtime=new PrivateDecisionRuntime({firewall:false});
  for(let i=0;i<width;i++) runtime.setPrivate(`secret.bit${i}`,value,{domain:{type:'integer',min:0,max:1}});
  const trajectory=runtime.beginTrajectory({purpose:'symbolic-joint-benchmark',maxBits:64,sinkMaxBits:64});
  const start=performance.now();
  const out=runtime.run({trajectoryId:trajectory.trajectoryId,agent:'benchmark',sink:'benchmark',program:rareBitsProgram(width)});
  const elapsedMs=performance.now()-start;
  return {out,elapsedMs};
}

const width=32;
const rare=run(width,1);
const common=run(width,0);
const stateSpace=2**width;

const result={
  benchmark:'scalable malicious candidate-set reconstruction',
  privateProfileBits:width,
  jointStates:stateSpace,
  publicCandidates:2,
  attack:'The rare winner is constructed to identify one exact profile among 2^32 possible joint private states.',
  rareWinner:{
    decision:rare.out.decision,
    resultReleased:Object.hasOwn(rare.out,'result'),
    beforeCandidates:rare.out.joint?.beforeCandidates,
    afterCandidates:rare.out.joint?.afterCandidates,
    realizedBits:rare.out.joint?.totalKnowledgeBits,
    analysis:rare.out.joint?.analysis,
    elapsedMs:Number(rare.elapsedMs.toFixed(3))
  },
  commonWinner:{
    decision:common.out.decision,
    released:common.out.result,
    beforeCandidates:common.out.joint?.beforeCandidates,
    afterCandidates:common.out.joint?.afterCandidates,
    publicRoundedMarginalBits:common.out.joint?.marginalKnowledgeBits,
    observationPersisted:common.out.decision==='allow' && common.out.reconstruction!==undefined,
    jointObservationCount:common.out.decision==='allow'?1:0,
    analysis:common.out.joint?.analysis,
    elapsedMs:Number(common.elapsedMs.toFixed(3))
  },
  caveat:'Synthetic finite-integer-domain explicit-output benchmark. Symbolic analysis supports the currently modeled choose semantics and fails closed when its work budget or supported semantics are exceeded.'
};

if(result.rareWinner.decision!=='deny'||result.rareWinner.resultReleased||result.rareWinner.beforeCandidates!==stateSpace||result.rareWinner.afterCandidates!==1||result.rareWinner.analysis?.method!=='symbolic-branch-and-bound') throw new Error('Rare joint-choice privacy invariant failed');
if(result.commonWinner.decision!=='allow'||result.commonWinner.released!=='fallback'||result.commonWinner.afterCandidates!==stateSpace-1||result.commonWinner.analysis?.method!=='symbolic-branch-and-bound') throw new Error('Common joint-choice utility invariant failed');

console.log(JSON.stringify(result,null,2));
