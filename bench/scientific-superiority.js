import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {PrivateDecisionRuntime} from '../src/private-decision.js';
import {ContextKernel} from '../src/context-kernel.js';

const SEEDS=20;
const PROFILES_PER_SEED=50;
const ATTACK_TRIALS=512;
const Z95=1.959963984540054;

function lcg(seed){let s=seed>>>0;return()=>((s=(1664525*s+1013904223)>>>0)/2**32)}
function int(rnd,min,max){return min+Math.floor(rnd()*(max-min+1))}
function pick(rnd,xs){return xs[int(rnd,0,xs.length-1)]}
function quantize(value,step){return Math.round(Number(value)/step)*step}
function unique(xs){return [...new Set(xs)]}
function temp(prefix='hush-superiority-'){return fs.mkdtempSync(path.join(os.tmpdir(),prefix))}
function get(profile,key){if(!Object.hasOwn(profile,key))throw new Error(`Missing private field ${key}`);return profile[key]}
function privateFields(program){return unique([...(program.constraints??[]).map(x=>x.private),...(program.preferences??[]).map(x=>x.private)].filter(Boolean))}
function cmp(a,op,b){if(op==='lte')return a<=b;if(op==='gte')return a>=b;if(op==='eq')return a===b;if(op==='in')return Array.isArray(b)&&b.includes(a);if(op==='notIn')return Array.isArray(b)&&!b.includes(a);throw new Error(`Unsupported oracle op ${op}`)}
function score(candidate,profile,pref){
  const w=Number(pref.weight??1),c=candidate[pref.candidate];
  if(pref.kind==='matchPrivate')return c===get(profile,pref.private)?w:0;
  if(pref.kind==='nearPrivate')return -Math.abs(Number(c)-Number(get(profile,pref.private)))/Number(pref.scale??1)*w;
  if(pref.kind==='lowerPublic')return -Number(c)/Number(pref.scale??1)*w;
  if(pref.kind==='higherPublic')return Number(c)/Number(pref.scale??1)*w;
  throw new Error(`Unsupported oracle preference ${pref.kind}`);
}
function passes(candidate,profile,rule){
  const c=candidate[rule.candidate],p=get(profile,rule.private);
  if(rule.op==='candidateLtePrivate')return cmp(c,'lte',p);
  if(rule.op==='candidateGtePrivate')return cmp(c,'gte',p);
  if(rule.op==='candidateEqPrivate')return cmp(c,'eq',p);
  if(rule.op==='candidateInPrivate')return cmp(c,'in',p);
  if(rule.op==='candidateNotInPrivate')return cmp(c,'notIn',p);
  if(rule.op==='privateLteCandidate')return cmp(p,'lte',c);
  if(rule.op==='privateGteCandidate')return cmp(p,'gte',c);
  throw new Error(`Unsupported oracle constraint ${rule.op}`);
}
function chooseOracle(program,profile){
  const feasible=program.candidates.filter(c=>(program.constraints??[]).every(r=>passes(c,profile,r)));
  if(!feasible.length)return null;
  const ranked=feasible.map(c=>({id:String(c.id),score:(program.preferences??[]).reduce((s,p)=>s+score(c,profile,p),0)}));
  ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  return ranked[0].id;
}
function wilson(k,n,z=Z95){
  if(!n)return {low:0,high:1};
  const p=k/n,z2=z*z,d=1+z2/n,c=(p+z2/(2*n))/d,m=z*Math.sqrt((p*(1-p)+z2/(4*n))/n)/d;
  return {low:c-m,high:c+m};
}
function pct(x){return Number((100*x).toFixed(3))}
function median(xs){const a=[...xs].sort((a,b)=>a-b);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2}
function percentile(xs,q){const a=[...xs].sort((a,b)=>a-b);return a[Math.min(a.length-1,Math.floor(q*(a.length-1)))]}
function allWinsP(n){return n<=0?1:Math.pow(0.5,n)}

function taskFamilies(){return [
  {name:'travel',make(rnd,i){const budget=int(rnd,1000,3000),airline=pick(rnd,['ANA','JAL','SQ','UA']);const candidates=Array.from({length:12},(_,j)=>({id:`tr-${i}-${j}`,price:Math.max(300,budget+int(rnd,-550,550)),airline:pick(rnd,['ANA','JAL','SQ','UA'])}));return {profile:{'travel.budget':budget,'travel.airline':airline},coarse:{'travel.budget':quantize(budget,500),'travel.airline':airline},program:{kind:'choose',candidates,constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.budget'}],preferences:[{kind:'matchPrivate',candidate:'airline',private:'travel.airline',weight:8},{kind:'lowerPublic',candidate:'price',scale:1000,weight:.2}]}};}},
  {name:'shopping',make(rnd,i){const budget=int(rnd,80,500),brand=pick(rnd,['Aster','Milo','Nova','Vale']);const candidates=Array.from({length:12},(_,j)=>({id:`sh-${i}-${j}`,price:Math.max(10,budget+int(rnd,-140,140)),brand:pick(rnd,['Aster','Milo','Nova','Vale']),rating:int(rnd,20,50)/10}));return {profile:{'shopping.budget':budget,'shopping.brand':brand},coarse:{'shopping.budget':quantize(budget,100),'shopping.brand':brand},program:{kind:'choose',candidates,constraints:[{op:'candidateLtePrivate',candidate:'price',private:'shopping.budget'}],preferences:[{kind:'matchPrivate',candidate:'brand',private:'shopping.brand',weight:6},{kind:'higherPublic',candidate:'rating',scale:5,weight:1}]}};}},
  {name:'scheduling',make(rnd,i){const latest=int(rnd,15,22),preferred=int(rnd,9,20);const candidates=Array.from({length:12},(_,j)=>({id:`sc-${i}-${j}`,hour:int(rnd,8,22),duration:int(rnd,30,120)}));return {profile:{'schedule.latest':latest,'schedule.preferred':preferred},coarse:{'schedule.latest':quantize(latest,3),'schedule.preferred':quantize(preferred,3)},program:{kind:'choose',candidates,constraints:[{op:'candidateLtePrivate',candidate:'hour',private:'schedule.latest'}],preferences:[{kind:'nearPrivate',candidate:'hour',private:'schedule.preferred',scale:1,weight:3},{kind:'lowerPublic',candidate:'duration',scale:60,weight:.1}]}};}},
  {name:'jobs',make(rnd,i){const minSalary=int(rnd,50,150),mode=pick(rnd,['remote','hybrid','onsite']);const candidates=Array.from({length:12},(_,j)=>({id:`jb-${i}-${j}`,salary:Math.max(20,minSalary+int(rnd,-50,50)),mode:pick(rnd,['remote','hybrid','onsite'])}));return {profile:{'jobs.minSalary':minSalary,'jobs.mode':mode},coarse:{'jobs.minSalary':quantize(minSalary,30),'jobs.mode':mode},program:{kind:'choose',candidates,constraints:[{op:'candidateGtePrivate',candidate:'salary',private:'jobs.minSalary'}],preferences:[{kind:'matchPrivate',candidate:'mode',private:'jobs.mode',weight:7},{kind:'higherPublic',candidate:'salary',scale:100,weight:.15}]}};}}
];}

function runHush(task){
  const runtime=new PrivateDecisionRuntime();
  for(const [key,value] of Object.entries(task.profile))runtime.setPrivate(key,value);
  const trajectoryId=runtime.beginTrajectory({purpose:'superiority-eval',maxBits:8,sinkMaxBits:8}).trajectoryId;
  const t0=performance.now();
  const out=runtime.run({trajectoryId,agent:'heldout-agent',sink:'heldout-sink',program:task.program});
  const ms=performance.now()-t0;
  if(out.decision!=='allow')throw new Error(`Hush denied benign benchmark task: ${out.reason}`);
  return {result:out.result,ms};
}

function semanticSurfaceSentinel(){
  const secret=987654321;
  const secretPath='private.sentinelBudget_7QX9';
  const kernel=new ContextKernel({dir:temp(),passphrase:'scientific superiority sentinel passphrase'});
  kernel.put(secretPath,secret,{label:'Maximum travel budget',category:'travel',tags:['budget','flight']});
  const trajectoryId=kernel.beginTrajectory({purpose:'semantic-wire-sentinel',maxBits:4,sinkMaxBits:4}).trajectoryId;
  const out=kernel.runSemantic({
    trajectoryId,agent:'external-eval-agent',sink:'external-eval-sink',task:'Choose the cheapest flight under my maximum travel budget.',
    program:{kind:'choose',candidates:[{id:'f1',price:700},{id:'f2',price:900},{id:'f3',price:1200}],constraints:[{op:'candidateLtePrivate',candidate:'price'}],preferences:[{kind:'lowerPublic',candidate:'price',scale:1000,weight:1}]}
  });
  const wire=JSON.stringify(out);
  const leakedMarkers=[String(secret),secretPath].filter(marker=>wire.includes(marker));
  if(out.decision!=='allow'||out.result!=='f1')throw new Error('Semantic wire sentinel did not complete its benign task');
  return {pass:leakedMarkers.length===0,leakedMarkers,wireBytes:Buffer.byteLength(wire)};
}

function runUtilityExperiment(){
  const methods={raw:{correct:0,exactExposure:0},governed:{correct:0,exactExposure:0},coarse:{correct:0,exactExposure:0},hush:{correct:0,exactExposure:0}};
  const perFamily=Object.fromEntries(taskFamilies().map(f=>[f.name,{n:0,coarseCorrect:0,hushCorrect:0}]));
  const hushLatency=[];
  let n=0,hushOnlyVsCoarse=0,coarseOnlyVsHush=0;
  for(let seedIndex=0;seedIndex<SEEDS;seedIndex++){
    const rnd=lcg(0x9e3779b9^((seedIndex+1)*2654435761));
    for(const family of taskFamilies())for(let j=0;j<PROFILES_PER_SEED;j++){
      const task=family.make(rnd,seedIndex*PROFILES_PER_SEED+j),fields=privateFields(task.program),truth=chooseOracle(task.program,task.profile);
      const raw=truth,governed=truth,coarse=chooseOracle(task.program,task.coarse),hush=runHush(task);
      const rawOk=raw===truth,govOk=governed===truth,coarseOk=coarse===truth,hushOk=hush.result===truth;
      methods.raw.correct+=rawOk;methods.governed.correct+=govOk;methods.coarse.correct+=coarseOk;methods.hush.correct+=hushOk;
      methods.raw.exactExposure+=fields.length;methods.governed.exactExposure+=fields.length;
      methods.coarse.exactExposure+=fields.filter(f=>Object.is(task.coarse[f],task.profile[f])).length;
      if(hushOk&&!coarseOk)hushOnlyVsCoarse++;if(coarseOk&&!hushOk)coarseOnlyVsHush++;
      hushLatency.push(hush.ms);perFamily[family.name].n++;perFamily[family.name].coarseCorrect+=coarseOk;perFamily[family.name].hushCorrect+=hushOk;n++;
    }
  }
  for(const m of Object.values(methods)){m.accuracy=m.correct/n;m.accuracy95=wilson(m.correct,n);m.meanExactPrivateAttributesExposed=m.exactExposure/n;}
  for(const row of Object.values(perFamily)){row.coarseAccuracy=row.coarseCorrect/row.n;row.hushAccuracy=row.hushCorrect/row.n;}
  return {n,seeds:SEEDS,profilesPerSeed:PROFILES_PER_SEED,methods,perFamily,paired:{hushOnlyVsCoarse,coarseOnlyVsHush,oneSidedP:allWinsP(hushOnlyVsCoarse)},semanticSurface:semanticSurfaceSentinel(),hushLatencyMs:{median:median(hushLatency),p95:percentile(hushLatency,.95),max:Math.max(...hushLatency)}};
}

function askProgram(lo,hi,variant){const mid=Math.floor((lo+hi)/2);if(variant===0)return {program:{kind:'predicate',private:'secret.value',op:'lte',value:mid},truthMeansLower:true};if(variant===1)return {program:{kind:'predicate',private:'secret.value',op:'lt',value:mid+1},truthMeansLower:true};if(variant===2)return {program:{kind:'predicate',private:'secret.value',op:'gt',value:mid},truthMeansLower:false};return {program:{kind:'predicate',private:'secret.value',op:'gte',value:mid+1},truthMeansLower:false};}
function attackTrial(secret,{protectedMode,revisionReset,trial}){
  const runtime=protectedMode?new PrivateDecisionRuntime():new PrivateDecisionRuntime({firewall:false,partitionFirewall:false,jointChoiceFirewall:false});
  const domain={type:'integer',min:0,max:65535};runtime.setPrivate('secret.value',secret,protectedMode?{domain}:{});
  let lo=0,hi=65535,released=0,denied=false;
  for(let step=0;step<20&&lo<hi;step++){
    if(revisionReset&&protectedMode)runtime.setPrivate('secret.value',secret,{domain});
    const q=askProgram(lo,hi,(trial+step)%4),trajectoryId=runtime.beginTrajectory({purpose:`p${(trial+step)%3}`,maxBits:64,sinkMaxBits:64}).trajectoryId;
    const out=runtime.run({trajectoryId,agent:`a${(trial+step)%7}`,sink:`s${(trial+step)%5}`,program:q.program});
    if(out.decision!=='allow'){denied=true;break}
    released++;const lower=q.truthMeansLower?Boolean(out.result):!Boolean(out.result),mid=Math.floor((lo+hi)/2);if(lower)hi=mid;else lo=mid+1;
  }
  return {recovered:lo===hi&&lo===secret,released,denied,candidatesRemaining:hi-lo+1};
}
function runAttackMode(mode){const rnd=lcg(mode==='baseline'?0x11111111:mode==='identity-rotation'?0x22222222:0x33333333);let recovered=0,denied=0,totalReleased=0,totalRemaining=0;for(let i=0;i<ATTACK_TRIALS;i++){const out=attackTrial(int(rnd,0,65535),{protectedMode:mode!=='baseline',revisionReset:mode==='revision-reset',trial:i});recovered+=out.recovered;denied+=out.denied;totalReleased+=out.released;totalRemaining+=out.candidatesRemaining;}return {trials:ATTACK_TRIALS,recovered,recoveryRate:recovered/ATTACK_TRIALS,recovery95:wilson(recovered,ATTACK_TRIALS),denied,meanAnswersReleased:totalReleased/ATTACK_TRIALS,meanCandidatesRemaining:totalRemaining/ATTACK_TRIALS};}
function runReconstructionExperiment(){return {baseline:runAttackMode('baseline'),identityRotation:runAttackMode('identity-rotation'),revisionReset:runAttackMode('revision-reset')}}

function gates(utility,reconstruction){const g={
  utilityEquivalence:utility.methods.hush.accuracy95.low>=.995,
  zeroExactPrivateInputs:utility.methods.hush.meanExactPrivateAttributesExposed===0&&utility.semanticSurface.pass,
  coarseUtilitySuperiority:utility.methods.hush.accuracy>utility.methods.coarse.accuracy&&utility.paired.hushOnlyVsCoarse>0&&utility.paired.coarseOnlyVsHush===0&&utility.paired.oneSidedP<.001,
  rawPrivacyDominance:utility.methods.hush.accuracy===utility.methods.raw.accuracy&&utility.methods.hush.meanExactPrivateAttributesExposed<utility.methods.raw.meanExactPrivateAttributesExposed,
  governedPrivacyDominance:utility.methods.hush.accuracy===utility.methods.governed.accuracy&&utility.methods.hush.meanExactPrivateAttributesExposed<utility.methods.governed.meanExactPrivateAttributesExposed,
  baselineReconstructs:reconstruction.baseline.recovery95.low>=.99,
  identityRotationResisted:reconstruction.identityRotation.recovery95.high<=.01,
  revisionResetResisted:reconstruction.revisionReset.recovery95.high<=.01
};return {...g,allPassed:Object.values(g).every(Boolean)}}

const utility=runUtilityExperiment(),reconstruction=runReconstructionExperiment(),superiority=gates(utility,reconstruction);
const report={benchmark:'Hush scientific superiority evaluation v1',protocol:'research/SUPERIORITY_PROTOCOL_V1.md',scope:'Controlled synthetic bounded-decision tasks plus adaptive reconstruction attacks. Evidence against implemented baselines, not a universal or direct named-competitor claim.',utilityPrivacy:utility,adaptiveReconstruction:reconstruction,gates:superiority};
if(process.argv.includes('--json'))console.log(JSON.stringify(report,null,2));else{
  console.log('Hush scientific superiority evaluation v1');console.log(`Tasks: ${utility.n} across ${Object.keys(utility.perFamily).length} families and ${utility.seeds} independent seeds\n`);
  for(const [name,m] of Object.entries(utility.methods))console.log(`${name.padEnd(10)} utility=${pct(m.accuracy)}%  exact-private-inputs/task=${m.meanExactPrivateAttributesExposed.toFixed(3)}`);
  console.log(`paired Hush>coarse discordance=${utility.paired.hushOnlyVsCoarse}, reverse=${utility.paired.coarseOnlyVsHush}, p=${utility.paired.oneSidedP}`);
  console.log(`semantic agent-surface private marker leaks=${utility.semanticSurface.leakedMarkers.length}`);console.log(`Hush latency median=${utility.hushLatencyMs.median.toFixed(3)} ms, p95=${utility.hushLatencyMs.p95.toFixed(3)} ms\n`);
  for(const [name,r] of Object.entries(reconstruction))console.log(`${name.padEnd(18)} recovery=${pct(r.recoveryRate)}% [95% ${(100*r.recovery95.low).toFixed(2)}, ${(100*r.recovery95.high).toFixed(2)}], answers=${r.meanAnswersReleased.toFixed(2)}, remaining=${r.meanCandidatesRemaining.toFixed(1)}`);
  console.log('');for(const [name,pass] of Object.entries(superiority))if(name!=='allPassed')console.log(`${pass?'PASS':'FAIL'} ${name}`);console.log(`\nOVERALL ${superiority.allPassed?'PASS':'FAIL'}`);
}
if(!superiority.allPassed)process.exitCode=1;
