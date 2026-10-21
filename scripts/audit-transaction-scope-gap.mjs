#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const arg=name=>{const i=process.argv.indexOf(name);if(i<0||!process.argv[i+1]) throw new Error(`${name} is required`);return process.argv[i+1];};
const primary=JSON.parse(fs.readFileSync(arg('--primary'),'utf8'));
const brokerSource=fs.readFileSync(new URL('../src/action-broker.js',import.meta.url),'utf8');

assert.equal(primary.status,'pass');
assert.equal(primary.pairedOrders.length,2);
for(const row of primary.pairedOrders){
  assert.equal(row.brokerVisibleEqual,true);
  assert.deepEqual(row.permissiveTrace,row.protectedTrace);
  assert.equal(row.permissiveCertificate.safe,true);
  assert.equal(row.protectedCertificate.safe,false);
  assert.deepEqual(row.protectedReleasedValues,[1,1]);
  assert.ok(row.protectedTrace.every(record=>record.outcome.decision==='allow'));
}
const apiChecks={
  noTransactionId:!brokerSource.includes('transactionId'),
  noGlobalAuthorization:!brokerSource.includes('globalAuthorization'),
  noScopeCommitment:!brokerSource.includes('authorizationScope')&&!brokerSource.includes('scopeCommitment'),
  noCumulativeGuardImport:!brokerSource.includes('cumulative-authorization-contract')
};
assert.ok(Object.values(apiChecks).every(Boolean));
assert.deepEqual(primary.minimumCorrectiveContract,[
  'transactionId','globalAuthorizationCommitment','localAuthorizationCommitment','preExecutionFactorizationCheck'
]);
const result={schema:'hush.transaction-scope-enforcement-gap.audit.v1',status:'pass',independent:true,pairedTraceChecks:2,apiChecks,mismatches:0};
fs.writeFileSync(arg('--output'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
