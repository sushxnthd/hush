#!/usr/bin/env node
import fs from 'node:fs';
import { ActionBroker } from '../src/action-broker.js';
import { certifyCumulativeAuthorization } from '../src/cumulative-authorization-contract.js';

const outputIndex=process.argv.indexOf('--output');
if(outputIndex<0||!process.argv[outputIndex+1]) throw new Error('--output is required');

const worlds=['00','01','10','11'];
const map=fn=>Object.fromEntries(worlds.map(world=>[world,fn(...world.split('').map(Number))]));
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=map((x,y)=>x^y);
const xMap=map(x=>x);
const yMap=map((x,y)=>y);

function normalizeTicket(ticket){
  return {
    decision:ticket.decision,reason:ticket.reason,agent:ticket.agent,sink:ticket.sink,
    purpose:ticket.purpose,category:ticket.category,adapter:ticket.adapter,
    action:ticket.action,resource:ticket.resource,argumentKeys:ticket.argumentKeys,
    credentialCount:ticket.credentialCount,requestHash:ticket.requestHash,
    rawCredentialIncluded:ticket.rawCredentialIncluded
  };
}

function normalizeOutcome(outcome){
  return {
    decision:outcome.decision,result:outcome.result,rawCredentialIncluded:outcome.rawCredentialIncluded,
    receipt:{agent:outcome.receipt.agent,sink:outcome.receipt.sink,purpose:outcome.receipt.purpose,
      category:outcome.receipt.category,adapter:outcome.receipt.adapter,action:outcome.receipt.action,
      resource:outcome.receipt.resource,status:outcome.receipt.status,
      credentialCount:outcome.receipt.credentialCount,rawCredentialIncluded:outcome.receipt.rawCredentialIncluded,
      requestHash:outcome.receipt.requestHash,resultDigest:outcome.receipt.resultDigest}
  };
}

async function runBroker(order){
  const hidden={x:1,y:1};
  let clock=Date.parse('2026-10-21T06:00:00Z');
  const broker=new ActionBroker({now:()=>clock++});
  broker.registerAdapter({name:'hidden-world',actions:['read_x','read_y'],execute:async({action})=>({value:hidden[action==='read_x'?'x':'y']})});
  const records=[];
  for(const action of order){
    const requested=broker.request({adapter:'hidden-world',action,agent:'fixture-agent',sink:'fixture-local',purpose:'paired authorization test',category:'read',resource:'hidden-world',arguments:{}});
    const approved=broker.approve(requested.actionId);
    const outcome=await broker.execute({actionId:requested.actionId,agent:'fixture-agent',sink:'fixture-local'});
    records.push({requested:normalizeTicket(requested),approved:normalizeTicket(approved),outcome:normalizeOutcome(outcome)});
  }
  return records;
}

const orders=[['read_x','read_y'],['read_y','read_x']];
const orderResults=[];
for(const order of orders){
  // The contract label is deliberately not passed to ActionBroker: its public
  // request/approval/execute API has no transaction-wide authorization input.
  const permissive=await runBroker(order);
  const protectedTrace=await runBroker(order);
  const calls=order.map(action=>({id:action,localAuthorization:action==='read_x'?xMap:yMap,observation:action==='read_x'?xMap:yMap}));
  const permissiveCertificate=certifyCumulativeAuthorization({worlds,globalAuthorization:identity,calls});
  const protectedCertificate=certifyCumulativeAuthorization({worlds,globalAuthorization:parity,calls});
  orderResults.push({
    order,
    brokerVisibleEqual:JSON.stringify(permissive)===JSON.stringify(protectedTrace),
    permissiveTrace:permissive,
    protectedTrace,
    permissiveCertificate,
    protectedCertificate,
    protectedReleasedValues:protectedTrace.map(record=>record.outcome.result.value)
  });
}

if(!orderResults.every(row=>row.brokerVisibleEqual)) throw new Error('paired broker traces unexpectedly differ');
if(!orderResults.every(row=>row.permissiveCertificate.safe&&!row.protectedCertificate.safe)) throw new Error('authorization oracle did not separate contracts');
if(!orderResults.every(row=>row.protectedTrace.every(record=>record.outcome.decision==='allow'))) throw new Error('production broker unexpectedly blocked a trace');
if(!orderResults.every(row=>JSON.stringify(row.protectedReleasedValues)==='[1,1]')) throw new Error('frozen release prediction failed');

const result={
  schema:'hush.transaction-scope-enforcement-gap.v1',status:'pass',
  proposition:'A broker cannot enforce an unrepresented transaction-wide authorization contract against locally identical traces.',
  pairedOrders:orderResults,
  counts:{orders:2,pairedExecutions:4,approvedActions:8,brokerVisibleMismatches:0,protectedContractRejections:0,oracleContractSeparations:2},
  minimumCorrectiveContract:['transactionId','globalAuthorizationCommitment','localAuthorizationCommitment','preExecutionFactorizationCheck'],
  smallestClaim:'The current ActionBroker API cannot universally enforce cumulative authorization because its broker-visible inputs omit the global transaction scope; transaction-bound scope metadata and a fail-closed pre-execution check are necessary.'
};
fs.writeFileSync(process.argv[outputIndex+1],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
