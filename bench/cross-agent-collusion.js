import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {PersistentReconstructionFirewall} from '../src/reconstruction-firewall.js';

const SECRET=42173;
const DOMAIN_MAX=65535; // 16-bit domain
const FIELD='profile.privateNumber';

function oneBit(runtime,{agent,sink,threshold}){
  const trajectory=runtime.beginTrajectory({purpose:'bounded-assistance',maxBits:1,sinkMaxBits:1});
  return runtime.run({
    trajectoryId:trajectory.trajectoryId,
    agent,
    sink,
    program:{kind:'predicate',private:FIELD,op:'gt',value:threshold}
  });
}

/**
 * Comparator: every provider owns a separate privacy ledger. Each individual
 * provider is allowed only one bit about the field, which looks conservative in
 * isolation. A colluding coalition rotates providers and destinations, combines
 * those individually-small disclosures, and reconstructs the full 16-bit secret.
 */
function siloedPerAgentAttack(){
  let lo=0,hi=DOMAIN_MAX,answers=0;
  const disclosures=[];
  while(lo<hi && answers<32){
    const mid=Math.floor((lo+hi)/2);
    const index=answers;
    const runtime=new PrivateDecisionRuntime({
      firewall:new PersistentReconstructionFirewall({fieldBudgetBits:1,audienceBudgetBits:1}),
      partitionFirewall:false,
      jointChoiceFirewall:false
    });
    runtime.setPrivate(FIELD,SECRET);
    const out=oneBit(runtime,{agent:`provider-${index}`,sink:`sink-${index}`,threshold:mid});
    if(out.decision!=='allow') break;
    disclosures.push({agent:`provider-${index}`,sink:`sink-${index}`,threshold:mid,result:out.result});
    answers++;
    if(out.result) lo=mid+1; else hi=mid;
  }
  return {answers,recovered:lo===hi&&lo===SECRET,remaining:hi-lo+1,range:[lo,hi],disclosures};
}

/**
 * Hush comparator: the same user-owned reconstruction ledger survives provider,
 * agent, trajectory, purpose and destination rotation. The coalition receives the
 * same sequence until the global field budget binds.
 */
function hushGlobalAttack(){
  const firewall=new PersistentReconstructionFirewall({fieldBudgetBits:8,audienceBudgetBits:1});
  const runtime=new PrivateDecisionRuntime({firewall,partitionFirewall:false,jointChoiceFirewall:false});
  runtime.setPrivate(FIELD,SECRET);
  let lo=0,hi=DOMAIN_MAX,answers=0,deniedAt=null;
  const disclosures=[];
  while(lo<hi && answers<32){
    const mid=Math.floor((lo+hi)/2);
    const index=answers;
    const out=oneBit(runtime,{agent:`provider-${index}`,sink:`sink-${index}`,threshold:mid});
    if(out.decision!=='allow'){
      deniedAt=answers+1;
      break;
    }
    disclosures.push({agent:`provider-${index}`,sink:`sink-${index}`,threshold:mid,result:out.result});
    answers++;
    if(out.result) lo=mid+1; else hi=mid;
  }
  return {answers,deniedAt,recovered:lo===hi&&lo===SECRET,remaining:hi-lo+1,range:[lo,hi],footprint:firewall.footprint(),disclosures};
}

const siloed=siloedPerAgentAttack();
const hush=hushGlobalAttack();

console.log('\nCross-agent collusion benchmark');
console.table({
  siloed_per_agent:{answers:siloed.answers,recovered:siloed.recovered,remaining:siloed.remaining,deniedAt:null},
  hush_global:{answers:hush.answers,recovered:hush.recovered,remaining:hush.remaining,deniedAt:hush.deniedAt}
});

if(!siloed.recovered) throw new Error('Siloed per-agent privacy ledgers should be composably vulnerable in this attack');
if(siloed.answers!==16) throw new Error(`Expected 16 one-bit provider disclosures, got ${siloed.answers}`);
if(hush.recovered) throw new Error('Hush global accounting must prevent exact coalition reconstruction');
if(hush.answers>8) throw new Error(`Global field budget failed to bind by 8 released bits: ${hush.answers}`);
if(hush.deniedAt!==9) throw new Error(`Expected the ninth novel bit to be denied, got denial at ${hush.deniedAt}`);
if(hush.remaining<256) throw new Error(`Hush should preserve at least 8 bits of uncertainty; remaining=${hush.remaining}`);

console.log(`Siloed coalition recovered ${SECRET} from ${siloed.answers} individually one-bit agents.`);
console.log(`Hush stopped the coalition after ${hush.answers} bits with ${hush.remaining} candidates still possible.`);
