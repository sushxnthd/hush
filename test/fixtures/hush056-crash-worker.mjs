// HUSH-056 real ActionBroker worker. Intentionally crashes after a durable
// simulated-provider side effect and before broker receipt completion.
import fs from 'node:fs';
import {ActionBroker} from '../../src/action-broker.js';

const [ledgerPath,mode,policy]=process.argv.slice(2);
if(!ledgerPath||!['crash','replay'].includes(mode)||!['unprotected','idempotent'].includes(policy)){
  throw new Error('Expected ledger path, crash|replay and unprotected|idempotent');
}
const REQUEST={
  adapter:'hush056-provider',action:'write',agent:'approved-client',
  sink:'simulated-provider',purpose:'test-only',category:'test',
  resource:'fixture',arguments:{logicalOperation:'same-approved-intent'}
};

function durableAppend(entry){
  const fd=fs.openSync(ledgerPath,'a');
  try{fs.writeSync(fd,JSON.stringify(entry)+'\n');fs.fsyncSync(fd);}
  finally{fs.closeSync(fd);}
}
function readLedger(){
  if(!fs.existsSync(ledgerPath)) return [];
  return fs.readFileSync(ledgerPath,'utf8').trim().split('\n')
    .filter(Boolean).map(line=>JSON.parse(line));
}
function send(message){
  return new Promise((resolve,reject)=>{
    if(!process.send) return reject(new Error('IPC required'));
    process.send(message,error=>error?reject(error):resolve());
  });
}

const broker=new ActionBroker();
broker.registerAdapter({
  name:'hush056-provider',actions:['write'],
  execute:async({request})=>{
    const key=request.requestHash;
    const previous=readLedger();
    const shouldApply=policy==='unprotected'||!previous.some(entry=>entry.key===key);
    if(shouldApply) durableAppend({key,operation:'write',effect:'durable-provider-effect'});
    await send({phase:'effect_committed',requestHash:key,applied:shouldApply,
                effects:readLedger().length});
    if(mode==='crash'){
      // Deliberately withhold the adapter return. Parent SIGKILLs this real
      // process after independently checking the durable provider ledger.
      setInterval(()=>{},1000);
      await new Promise(()=>{});
    }
    return {providerStatus:'ok'};
  }
});
const ticket=broker.request(REQUEST);
broker.approve(ticket.actionId);
const outcome=await broker.execute({
  actionId:ticket.actionId,agent:'approved-client',sink:'simulated-provider'
});
if(mode==='crash') throw new Error('Crash worker unexpectedly completed');
if(outcome.decision!=='allow') throw new Error('Replay did not complete');
await send({phase:'done',requestHash:ticket.requestHash,
            receipts:broker.receiptLog().length,decision:outcome.decision});
process.exit(0);
