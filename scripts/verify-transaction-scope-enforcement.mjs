#!/usr/bin/env node
import fs from 'node:fs';
import {ActionBroker} from '../src/action-broker.js';

const outputIndex=process.argv.indexOf('--output');
if(outputIndex<0||!process.argv[outputIndex+1]) throw new Error('--output is required');

const worlds=['00','01','10','11'];
const map=fn=>Object.fromEntries(worlds.map(world=>[world,fn(...world.split('').map(Number))]));
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=map((x,y)=>x^y);
const xMap=map(x=>x);
const yMap=map((x,y)=>y);

function fixture(){
  const dispatches=[];
  const broker=new ActionBroker();
  broker.registerAdapter({
    name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:xMap,read_y:yMap},
    execute:async({action})=>{dispatches.push(action);return {value:1};}
  });
  return {broker,dispatches};
}

async function runContract(transactionId,globalAuthorization,order){
  const {broker,dispatches}=fixture();
  const registration=broker.registerAuthorizationTransaction({transactionId,worlds,globalAuthorization});
  const outcomes=[];
  for(const action of order){
    const requested=broker.request({adapter:'hidden-world',action,transactionId,agent:'fixture',sink:'local'});
    broker.approve(requested.actionId);
    const out=await broker.execute({actionId:requested.actionId,agent:'fixture',sink:'local'});
    outcomes.push({action,decision:out.decision,reason:out.reason??null,status:out.receipt?.status??null,result:out.result??null,
      transactionId:out.receipt?.transactionId??null,globalAuthorizationCommitment:out.receipt?.globalAuthorizationCommitment??null,
      localAuthorizationCommitment:out.receipt?.localAuthorizationCommitment??null});
    if(out.decision!=='allow') break;
  }
  return {order,outcomes,dispatches,registration};
}

const identityRun=await runContract('identity',identity,['read_x','read_y']);
const protectedRuns=[];
for(const order of [['read_x','read_y'],['read_y','read_x']]) protectedRuns.push(await runContract(`parity-${order[0]}`,parity,order));

const closing=fixture();
closing.broker.registerAuthorizationTransaction({transactionId:'closing',worlds,globalAuthorization:identity});
const closingTicket=closing.broker.request({adapter:'hidden-world',action:'read_x',transactionId:'closing',agent:'fixture',sink:'local'});
closing.broker.approve(closingTicket.actionId);
closing.broker.closeAuthorizationTransaction('closing');
const closingOutcome=await closing.broker.execute({actionId:closingTicket.actionId,agent:'fixture',sink:'local'});

const mutation=fixture();
mutation.broker.registerAuthorizationTransaction({transactionId:'mutation',worlds,globalAuthorization:identity});
const mutationTicket=mutation.broker.request({adapter:'hidden-world',action:'read_x',transactionId:'mutation',agent:'fixture',sink:'local'});
mutation.broker.approve(mutationTicket.actionId);
mutation.broker.registerAdapter({name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:yMap,read_y:yMap},execute:async()=>{mutation.dispatches.push('mutated');return {value:1};}});
const mutationOutcome=await mutation.broker.execute({actionId:mutationTicket.actionId,agent:'fixture',sink:'local'});

const globalMutation=fixture();
globalMutation.broker.registerAuthorizationTransaction({transactionId:'global-mutation',worlds,globalAuthorization:identity});
const globalMutationTicket=globalMutation.broker.request({adapter:'hidden-world',action:'read_x',transactionId:'global-mutation',agent:'fixture',sink:'local'});
globalMutation.broker.approve(globalMutationTicket.actionId);
globalMutation.broker.authorizationTransactions.get('global-mutation').globalAuthorization['00']='changed';
const globalMutationOutcome=await globalMutation.broker.execute({actionId:globalMutationTicket.actionId,agent:'fixture',sink:'local'});

const ordinary=fixture();
const ordinaryTicket=ordinary.broker.request({adapter:'hidden-world',action:'read_x',agent:'fixture',sink:'local'});
ordinary.broker.approve(ordinaryTicket.actionId);
const ordinaryOutcome=await ordinary.broker.execute({actionId:ordinaryTicket.actionId,agent:'fixture',sink:'local'});

if(identityRun.outcomes.some(x=>x.decision!=='allow')||identityRun.dispatches.length!==2) throw new Error('identity utility gate failed');
if(protectedRuns.some(x=>x.outcomes.length!==1||x.outcomes[0].decision!=='deny'||x.dispatches.length!==0)) throw new Error('protected pre-dispatch gate failed');
if(closingOutcome.decision!=='deny'||closing.dispatches.length) throw new Error('transaction closure gate failed');
if(mutationOutcome.decision!=='deny'||mutation.dispatches.length) throw new Error('scope mutation gate failed');
if(globalMutationOutcome.decision!=='deny'||globalMutation.dispatches.length) throw new Error('global mutation gate failed');
if(ordinaryOutcome.decision!=='allow'||ordinary.dispatches.length!==1) throw new Error('ordinary compatibility gate failed');

const result={
  schema:'hush.transaction-scope-enforcement.v1',status:'pass',
  identityRun,protectedRuns,
  adversaries:{
    closedTransaction:{decision:closingOutcome.decision,reason:closingOutcome.reason,dispatches:closing.dispatches.length},
    mutatedLocalScope:{decision:mutationOutcome.decision,reason:mutationOutcome.reason,dispatches:mutation.dispatches.length},
    mutatedGlobalScope:{decision:globalMutationOutcome.decision,reason:globalMutationOutcome.reason,dispatches:globalMutation.dispatches.length}
  },
  ordinaryControl:{decision:ordinaryOutcome.decision,dispatches:ordinary.dispatches.length,result:ordinaryOutcome.result},
  counts:{identityAllows:2,identityDispatches:2,protectedOrders:2,protectedDenials:2,protectedDispatches:0,adversarialDenials:3,adversarialDispatches:0,ordinaryAllows:1},
  smallestClaim:'For explicitly registered finite-map transactions with trusted adapter scope declarations, ActionBroker now binds scope commitments into tickets and receipts and rejects non-factorizing, closed, or mutated scopes before credential resolution and adapter dispatch, while preserving identity-authorized and ordinary unscoped actions.',
  limits:['finite explicitly registered transactions','trusted local scope declarations','unscoped calls remain backward-compatible and are outside this guarantee','no distributed persistence or crash-recovery claim']
};
fs.writeFileSync(process.argv[outputIndex+1],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
