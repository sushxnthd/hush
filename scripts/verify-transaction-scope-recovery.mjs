import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const map=fn=>Object.fromEntries(worlds.map(world=>[world,fn(...world.split('').map(Number))]));
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=map((x,y)=>x^y);
const xMap=map(x=>x);
const yMap=map((x,y)=>y);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const canonical=value=>JSON.stringify(stable(value),null,2)+'\n';

function broker(file,key,calls=[]){
  const instance=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
  instance.registerAdapter({name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:xMap,read_y:yMap},execute:async({action})=>{calls.push(action);return {value:1}}});
  return instance;
}
async function execute(instance,transactionId,action){
  const request=instance.request({adapter:'hidden-world',action,transactionId,agent:'recovery',sink:'local'});
  instance.approve(request.actionId);
  return instance.execute({actionId:request.actionId,agent:'recovery',sink:'local'});
}

if(process.argv[2]==='--writer'){
  const file=process.argv[3];const key=Buffer.from(process.argv[4],'hex');const instance=broker(file,key);
  instance.registerAuthorizationTransaction({transactionId:'identity',worlds,globalAuthorization:identity});
  instance.registerAuthorizationTransaction({transactionId:'parity',worlds,globalAuthorization:parity});
  instance.registerAuthorizationTransaction({transactionId:'closed',worlds,globalAuthorization:identity});
  instance.closeAuthorizationTransaction('closed');
  process.stdout.write('READY\n');
  setInterval(()=>{},1000);
}else{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-scope-recovery-run-'));
  const file=path.join(dir,'authorization.enc.json');const key=crypto.randomBytes(32);
  try{
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--writer',file,key.toString('hex')],{stdio:['ignore','pipe','pipe']});
    let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk});
    await new Promise((resolve,reject)=>{let out='';child.stdout.on('data',chunk=>{out+=chunk;if(out.includes('READY'))resolve()});child.once('exit',code=>reject(new Error(`writer exited ${code}: ${stderr}`)));});
    child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));

    const calls=[];const recovered=broker(file,key,calls);
    const identityX=await execute(recovered,'identity','read_x');
    const identityY=await execute(recovered,'identity','read_y');
    const parityX=await execute(recovered,'parity','read_x');
    let closedRejected=false;try{recovered.request({adapter:'hidden-world',action:'read_x',transactionId:'closed'})}catch(error){closedRejected=/closed/.test(error.message)}
    let wrongKeyRejected=false;try{broker(file,crypto.randomBytes(32))}catch{wrongKeyRejected=true}
    const envelope=JSON.parse(fs.readFileSync(file,'utf8'));
    const original=Buffer.from(envelope.ciphertext,'base64url');const changed=Buffer.from(original);changed[0]^=1;envelope.ciphertext=changed.toString('base64url');
    const corrupt=path.join(dir,'corrupt.enc.json');fs.writeFileSync(corrupt,JSON.stringify(envelope));
    let corruptionRejected=false;try{broker(corrupt,key)}catch{corruptionRejected=true}
    const envelopeOnly=Object.keys(JSON.parse(fs.readFileSync(file,'utf8'))).sort();
    const checks={
      freshProcessKilled:true,
      identityAllows:identityX.decision==='allow'&&identityY.decision==='allow',
      parityDeniedBeforeDispatch:parityX.decision==='deny'&&calls.join(',')==='read_x,read_y',
      closedRemainsClosed:closedRejected,
      wrongKeyRejected,corruptionRejected,
      encryptedEnvelopeOnly:JSON.stringify(envelopeOnly)===JSON.stringify(['ciphertext','iv','tag','v'])
    };
    assert.ok(Object.values(checks).every(Boolean));
    const result={protocol:'hush.transaction-scope-recovery.v1',classification:'FRESH_PROCESS_CRASH_RECOVERY_AND_ADVERSARIAL_STORAGE_TEST',checks,decisions:{identity:[identityX.decision,identityY.decision],parity:parityX.decision,closed:'rejected'},dispatches:calls,smallestClaim:'On the single-writer local runtime, a synchronously persisted encrypted transaction snapshot survives process death, preserves open identity/parity authorization decisions, preserves closure, and fails closed under wrong-key or modified-ciphertext recovery.'};
    const output=canonical(result);if(process.argv[2])fs.writeFileSync(process.argv[2],output);process.stdout.write(output);
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
