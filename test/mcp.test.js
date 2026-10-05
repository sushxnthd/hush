import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_POLICY } from '../src/core.js';
import { McpToolCatalog, classifyMcpTool, evaluateMcpCall, sanitizeForwardHeaders } from '../src/mcp.js';

test('tools/list annotations are cached',()=>{
  const c=new McpToolCatalog();
  assert.equal(c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true}}]}}),1);
  assert.equal(c.get('search').name,'search');
});

test('known read-only tool may auto-allow only for explicitly trusted annotations',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true,openWorldHint:false}}]}});
  const untrusted=evaluateMcpCall({agent:'claude',purpose:'research',params:{name:'search',arguments:{q:'safe query'}},catalog:c,policy:DEFAULT_POLICY});
  assert.equal(untrusted.decision,'ask');
  const trusted=evaluateMcpCall({agent:'claude',purpose:'research',params:{name:'search',arguments:{q:'safe query'}},catalog:c,policy:DEFAULT_POLICY,trustAnnotations:true});
  assert.equal(trusted.decision,'allow');
});

test('unknown tool fails closed to ask',()=>{
  const r=evaluateMcpCall({agent:'claude',purpose:'task',params:{name:'mystery',arguments:{}},catalog:new McpToolCatalog(),policy:DEFAULT_POLICY});
  assert.equal(r.decision,'ask');
});

test('destructive annotation becomes destructive action',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'delete_repo',annotations:{readOnlyHint:false,destructiveHint:true}}]}});
  const r=evaluateMcpCall({agent:'claude',purpose:'cleanup',params:{name:'delete_repo',arguments:{repo:'x'}},catalog:c,policy:DEFAULT_POLICY,trustAnnotations:true});
  assert.equal(r.request.category,'destructive');
  assert.equal(r.request.action,'delete');
  assert.equal(r.decision,'ask');
});

test('raw credential in tool arguments is denied before policy',()=>{
  const c=new McpToolCatalog();
  c.ingestListResult({result:{tools:[{name:'search',annotations:{readOnlyHint:true}}]}});
  const r=evaluateMcpCall({agent:'claude',purpose:'research',params:{name:'search',arguments:{q:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}},catalog:c,policy:DEFAULT_POLICY,trustAnnotations:true});
  assert.equal(r.decision,'deny');
  assert.equal(r.hardDeny,true);
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

test('human preapproval cannot override a hard secret-exfiltration deny',()=>{
  const c=new McpToolCatalog();
  const params={name:'send_payload',arguments:{token:'sk-proj-abcdefghijklmnopqrstuvwxyz123456'}};
  const first=evaluateMcpCall({agent:'claude',purpose:'task',params,catalog:c,policy:DEFAULT_POLICY});
  assert.equal(first.decision,'deny');
  const retry=evaluateMcpCall({agent:'claude',purpose:'task',params,catalog:c,policy:DEFAULT_POLICY,preapprovedHash:first.requestHash});
  assert.equal(retry.decision,'deny');
  assert.equal(retry.hardDeny,true);
});

test('brokered auth replaces inbound authorization and preserves MCP headers',()=>{
  const h=sanitizeForwardHeaders({'authorization':'Bearer client-secret','mcp-protocol-version':'2026-07-28','mcp-name':'tool','x-hush-agent':'claude'},{brokeredAuth:'Bearer broker-secret'});
  assert.equal(h.authorization,'Bearer broker-secret');
  assert.equal(h['mcp-protocol-version'],'2026-07-28');
  assert.equal(h['x-hush-agent'],undefined);
});

test('read-only classification remains conservative for open-world tools',()=>{
  const x=classifyMcpTool({annotations:{readOnlyHint:true,openWorldHint:true}});
  assert.equal(x.action,'read');
  assert.equal(x.risk,'medium');
});
