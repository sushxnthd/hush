import {PartitionAwareReconstructionFirewall} from '../src/partition-firewall.js';

const secret=734219;
const domain={type:'integer',min:0,max:999999};
const nominalPredicateBits=1;
const realizedExactMatchBits=Math.log2(domain.max-domain.min+1);

const guard=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
guard.registerField('finance.balance',domain);
const exact=guard.evaluate({field:'finance.balance',program:{kind:'predicate',private:'finance.balance',op:'eq',value:secret},result:true});

const falseGuard=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8});
falseGuard.registerField('finance.balance',domain);
let falseQueries=0;
for(let guess=0;guess<1000;guess++){
  if(guess===secret) continue;
  const out=falseGuard.assessAndCommit({field:'finance.balance',program:{kind:'predicate',private:'finance.balance',op:'eq',value:guess},result:false});
  if(out.decision!=='allow') break;
  falseQueries++;
}

const binaryGuard=new PartitionAwareReconstructionFirewall({maxKnowledgeBits:8.01});
binaryGuard.registerField('finance.balance',domain);
let lo=domain.min,hi=domain.max,allowed=0,deniedAt=null;
for(let q=1;q<=30;q++){
  const mid=Math.floor((lo+hi)/2);
  const result=secret>mid;
  const out=binaryGuard.evaluate({field:'finance.balance',program:{kind:'predicate',private:'finance.balance',op:'gt',value:mid},result});
  if(out.decision!=='allow'){deniedAt=q;break;}
  binaryGuard.commit(out);
  allowed++;
  if(result) lo=mid+1; else hi=mid;
}

console.log(JSON.stringify({
  benchmark:'partition-aware realized leakage',
  domain:'0..999999',
  secret,
  cardinalityOnlyFailure:{
    query:`secret == ${secret}`,
    explicitOutputCardinality:2,
    nominalCapacityBits:nominalPredicateBits,
    realizedKnowledgeBits:Number(realizedExactMatchBits.toFixed(6)),
    exactSecretRevealedIfTrue:true
  },
  partitionGuard:{
    exactMatchDecision:exact.decision,
    exactMatchReason:exact.reason,
    exactMatchAfterCandidates:exact.afterCandidates,
    exactMatchRealizedBits:exact.marginalKnowledgeBits,
    harmlessFalseEqualityQueriesAllowed:falseQueries,
    harmlessFalseEqualityKnowledgeBits:falseGuard.status('finance.balance').totalKnowledgeBits,
    balancedBinarySearchAllowed:allowed,
    balancedBinarySearchDeniedAt:deniedAt,
    balancedBinarySearchRemaining:binaryGuard.status('finance.balance').remainingCandidates
  },
  caveat:'Finite-domain explicit-output experiment. This is not a universal privacy guarantee and does not cover timing, side effects, compromised hosts, or undeclared domains.'
},null,2));
