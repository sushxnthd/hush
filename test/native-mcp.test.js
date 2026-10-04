import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../src/context-kernel.js';
import {NATIVE_MCP_TOOLS,callNativeMcpTool,isNativeMcpTool} from '../src/native-mcp.js';

function kernel(){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'supakeep-native-mcp-'));
  const k=new ContextKernel({dir,passphrase:'native mcp test passphrase'});
  k.put('travel.maxBudget',1500,{category:'finance'});
  k.put('travel.preferredAirline','ANA',{category:'preference'});
  return k;
}

test('native MCP surface exposes bounded-computation tools only',()=>{
  assert.deepEqual(NATIVE_MCP_TOOLS.map(x=>x.name),[
    'supakeep_begin_private_task','supakeep_private_decision','supakeep_revoke_private_task'
  ]);
  assert.equal(isNativeMcpTool('supakeep_private_decision'),true);
  assert.equal(isNativeMcpTool('get_raw_context'),false);
  assert.equal(NATIVE_MCP_TOOLS.some(x=>/raw|secret|password/i.test(x.name)),false);
});

test('MCP client can personalize without receiving private values',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'supakeep_begin_private_task',args:{purpose:'choose flight',maxBits:3},kernel:k});
  assert.equal(start.isError,undefined);
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const out=callNativeMcpTool({name:'supakeep_private_decision',args:{trajectoryId,program:{
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

test('locked context fails closed through MCP',()=>{
  const out=callNativeMcpTool({name:'supakeep_begin_private_task',args:{},kernel:null});
  assert.equal(out.isError,true);
  assert.equal(out.structuredContent.decision,'deny');
});

test('revocation invalidates MCP trajectory',()=>{
  const k=kernel();
  const start=callNativeMcpTool({name:'supakeep_begin_private_task',args:{maxBits:1},kernel:k});
  const trajectoryId=start.structuredContent.trajectory.trajectoryId;
  const revoked=callNativeMcpTool({name:'supakeep_revoke_private_task',args:{trajectoryId},kernel:k});
  assert.equal(revoked.structuredContent.revoked,true);
  const out=callNativeMcpTool({name:'supakeep_private_decision',args:{trajectoryId,program:{kind:'predicate',private:'travel.maxBudget',op:'gte',value:1000}},kernel:k});
  assert.equal(out.isError,true);
  assert.match(out.structuredContent.reason,/revoked/);
});
