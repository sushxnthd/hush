import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {PersistentReconstructionFirewall} from '../src/reconstruction-firewall.js';

const SECRET=734219;
const DOMAIN_MAX=999999;

function attack({firewall,rotateSinks=false}){
  const runtime=new PrivateDecisionRuntime({firewall});
  runtime.setPrivate('finance.balance',SECRET);
  let lo=0,hi=DOMAIN_MAX,allowed=0,deniedAt=null;
  while(lo<hi && allowed<64){
    const mid=Math.floor((lo+hi)/2);
    const trajectory=runtime.beginTrajectory({purpose:`probe-${allowed}`,maxBits:1,sinkMaxBits:1});
    const out=runtime.run({
      trajectoryId:trajectory.trajectoryId,
      agent:`agent-${allowed}`,
      sink:rotateSinks?`sink-${allowed}`:'bank.example',
      program:{kind:'predicate',private:'finance.balance',op:'gt',value:mid}
    });
    if(out.decision!=='allow'){deniedAt=allowed+1;break;}
    allowed++;
    if(out.result) lo=mid+1; else hi=mid;
  }
  return {allowed,deniedAt,recovered:lo===hi&&lo===SECRET,remaining:hi-lo+1,range:[lo,hi]};
}

const baseline=attack({firewall:false});
const protectedSameSink=attack({firewall:new PersistentReconstructionFirewall({fieldBudgetBits:8,audienceBudgetBits:6})});
const protectedRotatingSinks=attack({firewall:new PersistentReconstructionFirewall({fieldBudgetBits:8,audienceBudgetBits:6}),rotateSinks:true});

console.log('\nCross-trajectory reconstruction benchmark');
console.table({baseline,protectedSameSink,protectedRotatingSinks});

if(!baseline.recovered) throw new Error('Baseline attack should reconstruct the secret');
if(protectedSameSink.recovered||protectedRotatingSinks.recovered) throw new Error('Persistent firewall should prevent exact reconstruction');
if(protectedSameSink.allowed>6) throw new Error('Per-audience reconstruction budget did not bind');
if(protectedRotatingSinks.allowed>8) throw new Error('Global field reconstruction budget did not bind');
