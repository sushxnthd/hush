import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const primaryPath=process.argv.includes('--primary')?process.argv[process.argv.indexOf('--primary')+1]:path.join(root,'research/pcc-runtime-product/transaction_scope_recovery.json');
const outputPath=process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:null;
const data=JSON.parse(fs.readFileSync(primaryPath,'utf8'));
const source=fs.readFileSync(path.join(root,'src/action-broker.js'),'utf8');
const worlds=['00','01','10','11'];
const identity=Object.fromEntries(worlds.map(world=>[world,world]));
const parity=Object.fromEntries(worlds.map(world=>[world,Number(world[0])^Number(world[1])]));
const x=Object.fromEntries(worlds.map(world=>[world,Number(world[0])]));
function factors(global,local){for(const a of worlds)for(const b of worlds)if(global[a]===global[b]&&local[a]!==local[b])return false;return true}
const registrationSource=source.slice(source.indexOf('registerAuthorizationTransaction('),source.indexOf('closeAuthorizationTransaction('));
const checks={
  primaryGate:Object.values(data.checks).every(Boolean),
  independentIdentityAllows:factors(identity,x),
  independentParityDenies:!factors(parity,x),
  exactDecisions:JSON.stringify(data.decisions.identity)===JSON.stringify(['allow','allow'])&&data.decisions.parity==='deny'&&data.decisions.closed==='rejected',
  noParityDispatch:JSON.stringify(data.dispatches)===JSON.stringify(['read_x','read_y']),
  authenticatedEncryptionPresent:source.includes('encryptJson(state,this.key)')&&source.includes('decryptJson('),
  commitmentRecomputedOnLoad:source.includes("if(commitment!==record.commitment) throw new Error('Authorization transaction commitment mismatch')"),
  registrationPersistsSynchronously:registrationSource.indexOf('this.authorizationTransactions.set(id')<registrationSource.indexOf('this._persistAuthorizationTransactions();')&&registrationSource.indexOf('this._persistAuthorizationTransactions();')!==-1,
  closurePersistsSynchronously:source.includes('transaction.closedAt=this.now();')&&source.includes('transaction.closedAt=before; throw error;'),
  restoreBeforeUse:source.indexOf('this.authorizationTransactions=this._loadAuthorizationTransactions()')<source.indexOf('this.tickets=new Map()')
};
const result={protocol:'hush.transaction-scope-recovery.audit.v1',classification:'INDEPENDENT_FINITE_MAP_AND_SOURCE_ORDER_AUDIT',checks,passed:Object.values(checks).filter(Boolean).length,total:Object.keys(checks).length,allPass:Object.values(checks).every(Boolean)};
assert.equal(result.allPass,true);const text=JSON.stringify(result,null,2)+'\n';if(outputPath)fs.writeFileSync(outputPath,text);process.stdout.write(text);
