import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ActionBroker,EncryptedAuthorizationStateStore} from '../src/action-broker.js';

const worlds=['00','01','10','11'];
const map=fn=>Object.fromEntries(worlds.map(world=>[world,fn(...world.split('').map(Number))]));
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=map((x,y)=>x^y);
const xMap=map(x=>x);
const yMap=map((x,y)=>y);

function fixture(file,key,calls=[]){
  const broker=new ActionBroker({authorizationStateStore:new EncryptedAuthorizationStateStore({file,key})});
  broker.registerAdapter({name:'hidden-world',actions:['read_x','read_y'],authorizationScopes:{read_x:xMap,read_y:yMap},execute:async({action})=>{calls.push(action);return {value:1}}});
  return broker;
}
async function execute(broker,transactionId,action){
  const request=broker.request({adapter:'hidden-world',action,transactionId,agent:'recovery',sink:'local'});
  broker.approve(request.actionId);
  return broker.execute({actionId:request.actionId,agent:'recovery',sink:'local'});
}
function temporary(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-scope-recovery-'));
  return {dir,file:path.join(dir,'authorization.enc.json'),key:crypto.randomBytes(32)};
}

test('open identity and parity transactions retain their decisions after restart',async t=>{
  const {dir,file,key}=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const before=fixture(file,key);
  before.registerAuthorizationTransaction({transactionId:'identity',worlds,globalAuthorization:identity});
  before.registerAuthorizationTransaction({transactionId:'parity',worlds,globalAuthorization:parity});

  const calls=[];const after=fixture(file,key,calls);
  assert.equal((await execute(after,'identity','read_x')).decision,'allow');
  assert.equal((await execute(after,'identity','read_y')).decision,'allow');
  const denied=await execute(after,'parity','read_x');
  assert.equal(denied.decision,'deny');
  assert.match(denied.reason,/GLOBAL_SCOPE_REFINEMENT/);
  assert.deepEqual(calls,['read_x','read_y']);
});

test('closed transaction remains closed after restart',t=>{
  const {dir,file,key}=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const before=fixture(file,key);
  before.registerAuthorizationTransaction({transactionId:'closed',worlds,globalAuthorization:identity});
  before.closeAuthorizationTransaction('closed');
  const after=fixture(file,key);
  assert.throws(()=>after.request({adapter:'hidden-world',action:'read_x',transactionId:'closed'}),/closed/);
});

test('modified ciphertext and wrong keys fail closed',t=>{
  const {dir,file,key}=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const before=fixture(file,key);
  before.registerAuthorizationTransaction({transactionId:'protected',worlds,globalAuthorization:identity});
  assert.throws(()=>fixture(file,crypto.randomBytes(32)));
  const envelope=JSON.parse(fs.readFileSync(file,'utf8'));
  const bytes=Buffer.from(envelope.ciphertext,'base64url');bytes[0]^=1;envelope.ciphertext=bytes.toString('base64url');
  fs.writeFileSync(file,JSON.stringify(envelope));
  assert.throws(()=>fixture(file,key));
});

test('unscoped actions are unchanged when durable transaction storage is configured',async t=>{
  const {dir,file,key}=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const calls=[];const broker=fixture(file,key,calls);
  const request=broker.request({adapter:'hidden-world',action:'read_x',agent:'recovery',sink:'local'});
  broker.approve(request.actionId);
  assert.equal((await broker.execute({actionId:request.actionId,agent:'recovery',sink:'local'})).decision,'allow');
  assert.deepEqual(calls,['read_x']);
  assert.equal(fs.existsSync(file),false);
});
