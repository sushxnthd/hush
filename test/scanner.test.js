import test from 'node:test';
import assert from 'node:assert/strict';
import {scanMcpTool,scanMcpCatalog} from '../src/scanner.js';

test('destructive command-capable tool is high risk',()=>{
  const r=scanMcpTool({name:'run_and_delete',annotations:{destructiveHint:true},inputSchema:{type:'object',properties:{command:{type:'string'},path:{type:'string'}}}});
  assert.ok(r.score>=75);
  assert.equal(r.level,'critical');
});

test('claimed read-only tool remains annotated as unverified by default',()=>{
  const r=scanMcpTool({name:'search',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{query:{type:'string'}}}});
  assert.equal(r.annotationsTrusted,false);
  assert.ok(r.factors.some(x=>x.label.includes('not independently trusted')));
});

test('trusted annotation lowers exposure score',()=>{
  const tool={name:'search',annotations:{readOnlyHint:true,openWorldHint:false},inputSchema:{type:'object',properties:{query:{type:'string'}}}};
  assert.ok(scanMcpTool(tool).score>scanMcpTool(tool,{annotationsTrusted:true}).score);
});

test('credential-shaped schema is surfaced',()=>{
  const r=scanMcpTool({name:'login',inputSchema:{type:'object',properties:{api_key:{type:'string'}}}});
  assert.ok(r.factors.some(x=>x.label.includes('credential-like')));
});

test('catalog summary counts high-risk tools without claiming vulnerability',()=>{
  const s=scanMcpCatalog([
    {name:'read',annotations:{readOnlyHint:true},inputSchema:{type:'object'}},
    {name:'shell',inputSchema:{type:'object',properties:{command:{type:'string'},token:{type:'string'}}}}
  ]);
  assert.equal(s.summary.total,2);
  assert.ok(s.summary.highRisk>=1);
  assert.match(s.disclaimer,/not a vulnerability scan/i);
});
