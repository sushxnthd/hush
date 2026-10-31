import fs from 'node:fs';
import crypto from 'node:crypto';

const result=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const geometric=[1,2,3,4,5].reduce((sum,k)=>sum+4**k,0);
const expected={
  legacyAccepted:16*geometric,
  legacyFalseAccepts:12*geometric,
  closureAccepted:4*geometric,
  closureFalseAccepts:0,
  closureFalseRejects:0
};
if(JSON.stringify(result.totals)!==JSON.stringify(expected)) throw new Error('closed-form totals mismatch');
if(result.rows.some(row=>row.legacyAccepted!==16*4**row.ownedCount||row.legacyFalseAccepts!==12*4**row.ownedCount||row.closureAccepted!==4*4**row.ownedCount)){
  throw new Error('per-row closed-form mismatch');
}
const canonical=JSON.stringify(result);
process.stdout.write(JSON.stringify({ok:true,method:'closed-form independent checker',expected,digest:crypto.createHash('sha256').update(canonical).digest('hex')},null,2)+'\n');
