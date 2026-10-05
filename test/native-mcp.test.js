import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {NATIVE_MCP_TOOLS,callNativeMcpTool,isNativeMcpTool} from '../src/native-mcp.js';

function kernel(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-native-mcp-'));
  const k=new ContextKernel({dir,passphrase:'native mcp test passphrase'});
  k.put('travel.maxBudget',1500,{label:'Maximum travel budget',category:'travel',tags:['budget','flight']});
  k.put('travel.preferredAirline','ANA',{label:'Preferred airline',category:'travel',tags:['airline','preference']});
  return k;
}

test('native MCP surface exposes bounded computation, routing, and approval-gated memory proposals',()=>{
  assert.deepEqual(NATIVE_MCP_TOOLS.map(x=>x.name),[
    'hush_begin_private_task','hush_private_query','hush_private_decision','hush_route_task','hush_propose_memory','hush_revoke_private_task'
  ]);
  assert.equal(isNativeMcpTool('hush_private_query'),true);
  assert.equal(isNativeMcpTool('hush_private_decision'),true);
  assert.equal(isNativeMcpTool('hush_route_task'),true);
  assert.equal(isNativeMcpTool('hush_propose_memory'),true);
  assert.equal(isNativeMcpTool('get_raw_context'),false);
  assert.equal(NATIVE_MCP_TOOLS.some(x=>/raw|secret|password/i.test(x.name)),false);
  const semantic=NATIVE_MCP_TOOLS.find(x=>x.name==='hush_private_query');
  assert.equal(semantic.inputSchema.properties.task.maxLength,1000);
  const predicate=semantic.inputSchema.properties.program.oneOf[0];
  assert.equal(predicate.required.includes('privateRef'),false);
});

test('MCP client can personalize semantically without knowing private paths or values',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'choose flight',maxBits:3},kernel:k});
  assert.equal(start.isError,undefined);
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,program:{
    kind:'choose',
    candidates:[{id:'a',price:1200,airline:'JAL'},{id:'b',price:1490,airline:'ANA'},{id:'c',price:1800,airline:'ANA'}],
    constraints:[{op:'candidateLtePrivate',candidate:'price',privateRef:{query:'travel budget'}}],
    preferences:[
      {kind:'matchPrivate',candidate:'airline',privateRef:{query:'preferred airline'},weight:10},
      {kind:'lowerPublic',candidate:'price',scale:1000,weight:0.01}
    ]
  }},kernel:k,agent:'assistant',sink:'mcp:test'});
  assert.equal(out.structuredContent.decision,'allow');
  assert.equal(out.structuredContent.result,'b');
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('travel.maxBudget'),false);
  assert.equal(wire.includes('travel.preferredAirline'),false);
  assert.equal(wire.includes('1500'),false);
  assert.equal(wire.includes('ANA'),false);
});

test('MCP client can omit privateRef when task and clause roles identify context',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'choose flight',maxBits:3},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_query',args:{
    trajectoryId,
    task:'Choose a flight under my travel budget and prefer my usual airline.',
    program:{
      kind:'choose',
      candidates:[{id:'a',price:1200,airline:'JAL'},{id:'b',price:1490,airline:'ANA'},{id:'c',price:1800,airline:'ANA'}],
      constraints:[{op:'candidateLtePrivate',candidate:'price'}],
      preferences:[
        {kind:'matchPrivate',candidate:'airline',weight:10},
        {kind:'lowerPublic',candidate:'price',scale:1000,weight:0.01}
      ]
    }
  },kernel:k,agent:'assistant',sink:'mcp:test'});
  assert.equal(out.structuredContent.decision,'allow');
  assert.equal(out.structuredContent.result,'b');
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('travel.maxBudget'),false);
  assert.equal(wire.includes('travel.preferredAirline'),false);
  assert.equal(wire.includes('1500'),false);
  assert.equal(wire.includes('ANA'),false);
});

test('MCP router chooses from user-registered models without receiving private context',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-native-router-'));
  const k=new ContextKernel({dir,passphrase:'native router test passphrase'});
  k.registerModel({id:'local',provider:'local',locality:'local',capabilities:['chat'],quality:0.7});
  k.registerModel({id:'remote-smart',provider:'provider-a',locality:'remote',trustLevel:'standard',capabilities:['chat','reasoning'],quality:0.95,inputCostPerMillion:2,outputCostPerMillion:8,latencyMs:800});
  const out=callNativeMcpTool({
    name:'hush_route_task',
    args:{task:'Solve a difficult problem.',requiredCapabilities:['reasoning'],privateContext:'bounded',privacyPreference:'strict'},
    kernel:k,agent:'assistant',sink:'mcp:test'
  });
  assert.equal(out.structuredContent.decision,'allow');
  assert.equal(out.structuredContent.model.id,'remote-smart');
  assert.equal(out.structuredContent.request.privateContext,'bounded');
});

test('MCP router refuses tasks declared to require raw private context',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-native-router-raw-'));
  const k=new ContextKernel({dir,passphrase:'native router raw context passphrase'});
  k.registerModel({id:'local',provider:'local',locality:'local',capabilities:['chat'],quality:0.7});
  const out=callNativeMcpTool({name:'hush_route_task',args:{requiredCapabilities:['chat'],privateContext:'raw'},kernel:k});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
  assert.match(out.structuredContent.reason,/does not route tasks that require raw private context/i);
});

test('MCP memory proposal does not echo or commit the proposed value before local approval',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-native-memory-'));
  const k=new ContextKernel({dir,passphrase:'native memory proposal passphrase'});
  const out=callNativeMcpTool({
    name:'hush_propose_memory',
    args:{label:'Preferred seat',category:'travel',tags:['seat','preference'],value:'aisle'},
    kernel:k,agent:'assistant-a',sink:'mcp:test'
  });
  assert.equal(out.structuredContent.decision,'ask');
  assert.equal(out.structuredContent.valueIncluded,false);
  assert.equal(k.list().length,0);
  assert.equal(JSON.stringify(out).includes('aisle'),false);
  assert.equal(k.memoryProposalQueue({includeValues:true})[0].value,'aisle');
});

test('low-level compatibility tool still performs bounded private decisions',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'choose flight',maxBits:3},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_decision',args:{trajectoryId,program:{
    kind:'choose',
    candidates:[{id:'a',price:1200,airline:'JAL'},{id:'b',price:1490,airline:'ANA'},{id:'c',price:1800,airline:'ANA'}],
    constraints:[{op:'candidateLtePrivate',candidate:'price',private:'travel.maxBudget'}],
    preferences:[{kind:'matchPrivate',candidate:'airline',private:'travel.preferredAirline',weight:10}]
  }},kernel:k,agent:'assistant',sink:'mcp:test'});
  assert.equal(out.structuredContent.decision,'allow');
  assert.equal(out.structuredContent.result,'b');
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('1500'),false);
  assert.equal(wire.includes('ANA'),false);
});

test('semantic selector ambiguity fails closed without revealing private paths',()=>{
  const k=kernel();
  k.put('travel.backupBudget',900,{label:'Backup travel budget',category:'travel',tags:['budget','flight']});
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'budget check',maxBits:1},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,program:{kind:'predicate',privateRef:{category:'travel',tags:['budget','flight']},op:'gte',value:1000}},kernel:k});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
  assert.match(out.structuredContent.reason,/ambiguous/i);
  const wire=JSON.stringify(out);
  assert.equal(wire.includes('travel.maxBudget'),false);
  assert.equal(wire.includes('travel.backupBudget'),false);
});

test('semantic agent surface rejects raw private paths',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{maxBits:1},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,program:{kind:'predicate',private:'travel.maxBudget',op:'gte',value:1000}},kernel:k});
  assert.equal(out.isError,true);
  assert.match(out.structuredContent.reason,/must not contain raw private paths|must use privateRef|task inference/i);
});

test('partition-aware privacy guard denies rare result through native MCP before release',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-native-mcp-partition-'));
  const k=new ContextKernel({dir,passphrase:'native partition test passphrase'});
  k.put('finance.balance',734219,{label:'Account balance',category:'finance',tags:['balance'],domain:{type:'integer',min:0,max:999999}});
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'eligibility',maxBits:8,sinkMaxBits:8},kernel:k,agent:'assistant',sink:'mcp:test'});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,program:{kind:'predicate',privateRef:{query:'account balance'},op:'eq',value:734219}},kernel:k,agent:'assistant',sink:'mcp:test'});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
  assert.equal('result' in out.structuredContent,false);
  assert.equal(out.structuredContent.partition.afterCandidates,1);
  assert.ok(out.structuredContent.partition.marginalKnowledgeBits>19.9);
  assert.equal(JSON.stringify(out).includes('"result":true'),false);
});

test('locked context fails closed through MCP',()=>{
  const out=callNativeMcpTool({name:'hush_begin_private_task',args:{},kernel:null});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
});

test('revocation invalidates MCP trajectory',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'hush_begin_private_task',args:{maxBits:1},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const revoked=callNativeMcpTool({name:'hush_revoke_private_task',args:{trajectoryId},kernel:k});
  assert.equal(revoked.structuredContent.revoked,true);
  const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,program:{kind:'predicate',privateRef:{query:'travel budget'},op:'gte',value:1000}},kernel:k});
  assert.equal(out.isError,true);
  assert.match(out.structuredContent.reason,/revoked/);
});
