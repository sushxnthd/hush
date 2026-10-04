import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY } from '../src/core.js';
import { McpToolCatalog, classifyMcpTool, evaluateMcpCall, sanitizeForwardHeaders } from '../src/mcp.js';

test('tools/list annotations are cached',()=>{
  const c=new McpToolCatalog();
  assert.equal(c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true}}]}}),1);
  assert.equal(c.get('search').name,'search');
});

test('known read-only tool follows allow-read policy',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true,openWorldHint:false}}]}});
  const r=evaluateMcpCall({agent:'claude',purpose:'research',params:{name:'search',arguments:{q:'safe query'}},catalog:c,policy:DEFAULT_POLICY});
  assert.equal(r.decision,'allow');
});

test('unknown tool fails closed to ask',()=>{
  const r=evaluateMcpCall({agent:'claude',purpose:'task',params:{name:'mystery',arguments:{}},catalog:new McpToolCatalog(),policy:DEFAULT_POLICY});
  assert.equal(r.decision,'ask');
});

test('destructive annotation becomes destructive action',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'delete_repo',annotations:{readOnlyHint:false,destructiveHint:true}}]}});
  const r=evaluateMcpCall({agent:'claude',purpose:'cleanup',params:{name:'delete_repo',arguments:{repo:'x'}},catalog:c,policy:DEFAULT_POLICY});
  assert.equal(r.request.category,'destructive');
  assert.equal(r.request.action,'delete');
  assert.equal(r.decision,'ask');
});

test('raw credential in tool arguments is denied before policy',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true}}]}});
  const r=evaluateMcpCall({agent:'claude',purpose:'research',params:{name:'search',arguments:{q:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}},catalog:c,policy:DEFAULT_POLICY});
  assert.equal(r.decision,'deny');
});

test('preapproval only applies to exact same tool call',()=>{
  const c=new McpToolCatalog();
  const first=evaluateMcpCall({agent:'claude',purpose:'mail',params:{name:'send_email',arguments:{to:'a@example.com',body:'hi'}},catalog:c,policy:DEFAULT_POLICY});
  assert.equal(first.decision,'ask');
  const approved=evaluateMcpCall({agent:'claude',purpose:'mail',params:{name:'send_email',arguments:{to:'a@example.com',body:'hi'}},catalog:c,policy:DEFAULT_POLICY,preapprovedHash:first.requestHash});
  assert.equal(approved.decision,'allow');
  const changed=evaluateMcpCall({agent:'claude',purpose:'mail',params:{name:'send_email',arguments:{to:'b@example.com',body:'hi'}},catalog:c,policy:DEFAULT_POLICY,preapprovedHash:first.requestHash});
  assert.equal(changed.decision,'ask');
});

test('brokered auth replaces inbound authorization and preserves MCP headers',()=>{
  const h=sanitizeForwardHeaders({'authorization':'Bearer client-secret','mcp-protocol-version':'2026-07-28','mcp-name':'tool','x-supakeep-agent':'claude'},{brokeredAuth:'Bearer broker-secret'});
  assert.equal(h.authorization,'Bearer broker-secret');
  assert.equal(h['mcp-protocol-version'],'2026-07-28');
  assert.equal(h['x-supakeep-agent'],undefined);
});

test('read-only classification remains conservative for open-world tools',()=>{
  const x=classifyMcpTool({annotations:{readOnlyHint:true,openWorldHint:true}});
  assert.equal(x.action,'read');
  assert.equal(x.risk,'medium');
});
