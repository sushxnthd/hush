import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {handleOwnerContextRequest} from '../src/owner-context-http.js';
async function call(path,method,kernel,payload={}){const req=Readable.from([Buffer.from(JSON.stringify(payload))]);req.method=method;let result;const audits=[];const handled=await handleOwnerContextRequest({req,res:{},u:new URL(path,'http://localhost'),kernel,send:(_,status,body)=>result={status,body},audit:(...args)=>audits.push(args)});return {handled,...result,audits};}
test('owner memory route is separate from MCP and includes values only for owner review',async()=>{
  const kernel={memoryProposalQueue:options=>{assert.equal(options.includeValues,true);return [{value:'owner-reviewed value'}];}};
  assert.equal((await call('/mcp','GET',kernel)).handled,false);
  assert.equal((await call('/api/context','GET',kernel)).handled,false);
  const out=await call('/api/context/owner/memory','GET',kernel);assert.equal(out.status,200);assert.equal(out.body.proposals[0].value,'owner-reviewed value');
});
test('owner proposals validate fields and audit only opaque IDs',async()=>{
  const kernel={proposeMemory:b=>{assert.equal(b.value,'PRIVATE-MEMORY-CANARY');return {proposalId:'proposal-1'};}};
  const out=await call('/api/context/owner/memory','POST',kernel,{label:'Preference',value:'PRIVATE-MEMORY-CANARY'});
  assert.equal(out.status,201);assert.equal(JSON.stringify(out.audits).includes('CANARY'),false);
  assert.equal((await call('/api/context/owner/memory','POST',kernel,{label:'',value:'x'})).status,400);
});
test('owner approve, reject and removal dispatch to the kernel and do not audit plaintext paths',async()=>{
  const kernel={approveMemoryProposal:id=>({id,decision:'approved'}),denyMemoryProposal:id=>({id,decision:'deny'}),remove:p=>p==='PRIVATE-PATH-CANARY'};
  assert.equal((await call('/api/context/owner/memory/id-1/approve','POST',kernel)).body.proposal.decision,'approved');
  assert.equal((await call('/api/context/owner/memory/id-1/deny','POST',kernel)).body.proposal.decision,'deny');
  const out=await call('/api/context/owner/remove','POST',kernel,{path:'PRIVATE-PATH-CANARY'});assert.equal(out.status,200);assert.equal(JSON.stringify(out.audits).includes('CANARY'),false);
  assert.equal((await call('/api/context/owner/remove','POST',kernel,{path:'missing'})).status,404);
});
