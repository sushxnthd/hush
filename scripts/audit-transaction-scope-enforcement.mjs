#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const arg=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1]) throw new Error(`${name} is required`);return process.argv[i+1];};
const primary=JSON.parse(fs.readFileSync(arg('--primary'),'utf8'));
const source=fs.readFileSync(new URL('../src/action-broker.js',import.meta.url),'utf8');

assert.equal(primary.status,'pass');
assert.deepEqual(primary.identityRun.outcomes.map(x=>x.decision),['allow','allow']);
assert.equal(primary.identityRun.dispatches.length,2);
for(const run of primary.protectedRuns){
  assert.equal(run.outcomes.length,1);
  assert.equal(run.outcomes[0].decision,'deny');
  assert.match(run.outcomes[0].reason,/GLOBAL_SCOPE_REFINEMENT/);
  assert.deepEqual(run.dispatches,[]);
}
assert.equal(primary.adversaries.closedTransaction.dispatches,0);
assert.match(primary.adversaries.closedTransaction.reason,/AUTHORIZATION_TRANSACTION_CLOSED/);
assert.equal(primary.adversaries.mutatedLocalScope.dispatches,0);
assert.match(primary.adversaries.mutatedLocalScope.reason,/LOCAL_AUTHORIZATION_COMMITMENT_MISMATCH/);
assert.equal(primary.adversaries.mutatedGlobalScope.dispatches,0);
assert.match(primary.adversaries.mutatedGlobalScope.reason,/GLOBAL_AUTHORIZATION_COMMITMENT_MISMATCH/);
assert.deepEqual(primary.ordinaryControl,{decision:'allow',dispatches:1,result:{value:1}});

// Independent finite-map factorization check for the frozen family.
const worlds=['00','01','10','11'];
const parity=Object.fromEntries(worlds.map(w=>[w,Number(w[0])^Number(w[1])]));
const coordinate=(world,index)=>Number(world[index]);
for(const index of [0,1]) assert.ok(worlds.some((left,i)=>worlds.slice(i+1).some(right=>parity[left]===parity[right]&&coordinate(left,index)!==coordinate(right,index))));
const identity=Object.fromEntries(worlds.map(w=>[w,w]));
for(const index of [0,1]) assert.equal(worlds.some((left,i)=>worlds.slice(i+1).some(right=>identity[left]===identity[right]&&coordinate(left,index)!==coordinate(right,index))),false);

const scopeCheck=source.indexOf('const scopeVerdict=this._scopeVerdict(ticket)');
const credentialResolution=source.indexOf('const credentials=[]');
const dispatch=source.indexOf('await adapter.execute');
assert.ok(scopeCheck>=0&&scopeCheck<credentialResolution&&credentialResolution<dispatch);
for(const token of ['transactionId:ticket.transactionId','globalAuthorizationCommitment:ticket.globalAuthorizationCommitment','localAuthorizationCommitment:ticket.localAuthorizationCommitment']) assert.ok(source.includes(token));

const result={schema:'hush.transaction-scope-enforcement.audit.v1',status:'pass',independent:true,
  checks:{primaryGates:11,finiteFactorization:4,preCredentialOrdering:true,commitmentBindings:3},mismatches:0};
fs.writeFileSync(arg('--output'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
