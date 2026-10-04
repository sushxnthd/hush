import {PrivateDecisionRuntime} from '../src/private-decision.js';

const WIDTH=16;

function program(width=WIDTH){
  const rare={id:'rare-profile',bias:width-0.5};
  const fallback={id:'fallback',bias:0};
  const preferences=[];
  for(let i=0;i<width;i++){
    rare[`bit${i}`]=1;
    fallback[`bit${i}`]=0;
    preferences.push({kind:'matchPrivate',candidate:`bit${i}`,private:`secret.bit${i}`,weight:1});
  }
  preferences.push({kind:'lowerPublic',candidate:'bias',weight:1,scale:1});
  return {kind:'choose',candidates:[rare,fallback],preferences};
}

function build(bits,{joint=true}={}){
  const runtime=new PrivateDecisionRuntime({firewall:false,jointChoiceFirewall:joint?undefined:false});
  bits.forEach((bit,i)=>runtime.setPrivate(`secret.bit${i}`,bit,{domain:{type:'integer',min:0,max:1}}));
  return runtime;
}

function query(runtime){
  const trajectory=runtime.beginTrajectory({purpose:'malicious-choice-set',maxBits:2,sinkMaxBits:2});
  return runtime.run({trajectoryId:trajectory.trajectoryId,agent:'adversarial-recommender',sink:'recommender.example',program:program()});
}

const target=Array(WIDTH).fill(1);
const common=[...target];
common[WIDTH-1]=0;

const baseline=query(build(target,{joint:false}));
const protectedRare=query(build(target));
const protectedCommon=query(build(common));

console.log(JSON.stringify({
  benchmark:'malicious candidate-set joint reconstruction',
  privateProfileBits:WIDTH,
  jointStates:2**WIDTH,
  publicCandidates:2,
  explicitOutputCardinality:3,
  nominalCapacityBits:Number(Math.log2(3).toFixed(6)),
  attackConstruction:'Two public candidates plus weighted private-match preferences. The rare candidate wins only for one of 65,536 possible joint profiles.',
  results:{
    cardinalityOnly:{
      decision:baseline.decision,
      released:baseline.result??null,
      nominalBits:baseline.capacity?.marginalBits??null,
      realizedBitsIfRare:WIDTH,
      exactJointProfileIdentified:baseline.result==='rare-profile'
    },
    jointGuardRare:{
      decision:protectedRare.decision,
      resultReleased:'result' in protectedRare,
      beforeCandidates:protectedRare.joint?.beforeCandidates??null,
      afterCandidates:protectedRare.joint?.afterCandidates??null,
      realizedBits:protectedRare.joint?.totalKnowledgeBits??null,
      reason:protectedRare.reason
    },
    jointGuardCommon:{
      decision:protectedCommon.decision,
      released:protectedCommon.result??null,
      remainingCandidates:protectedCommon.joint?.afterCandidates??null,
      realizedBits:protectedCommon.joint?.marginalKnowledgeBits??null
    }
  },
  caveat:'Finite enumerated integer domains and explicit choose outputs only. This does not cover large/continuous domains, timing, side effects, compromised hosts, undeclared fields, or arbitrary external inference.'
},null,2));
