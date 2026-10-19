import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ContextKernel} from '../../src/context-kernel.js';
import {callNativeMcpTool} from '../../src/native-mcp.js';
import {canonicalize} from '../../src/core.js';

const paths=['travel.maxBudget','finance.maxBudget','shopping.maxBudget','housing.maxBudget','education.maxBudget','health.maxBudget','insurance.maxBudget','transport.maxBudget','food.maxBudget','entertainment.maxBudget','gifts.maxBudget','charity.maxBudget','subscriptions.maxBudget','utilities.maxBudget','vacation.maxBudget','events.maxBudget','projects.maxBudget','research.maxBudget','hardware.maxBudget','software.maxBudget','cloud.maxBudget','hiring.maxBudget','marketing.maxBudget','legal.maxBudget','tax.maxBudget','savings.maxBudget','investing.maxBudget','emergency.maxBudget','family.maxBudget','personal.maxBudget','business.maxBudget','other.maxBudget'];
const rows=[];
for(const [index,privatePath] of paths.entries()){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-semantic-correction-'));
  try{
    const k=new ContextKernel({dir,passphrase:'semantic digest frozen probe',now:()=>1735689600000+index});
    k.put(privatePath,1500,{label:'Planning ceiling',category:'planning',tags:['budget']});
    const start=callNativeMcpTool({name:'hush_begin_private_task',args:{purpose:'check planning ceiling',maxBits:2},kernel:k});
    const trajectoryId=start.structuredContent.trajectory.trajectoryId;
    const out=callNativeMcpTool({name:'hush_private_query',args:{trajectoryId,task:'Check whether my planning ceiling is at least 1000.',program:{kind:'predicate',privateRef:{label:'Planning ceiling',category:'planning',tags:['budget']},op:'gte',value:1000}},kernel:k,agent:'assistant',sink:'mcp:frozen-probe'});
    const wire=JSON.stringify(out);
    rows.push({index,authorizedResult:out.structuredContent?.result??null,hasDigest:Object.hasOwn(out.structuredContent?.receipt??{},'privatePathsHash'),hasRawPath:wire.includes(privatePath),observation:{decision:out.structuredContent?.decision,result:out.structuredContent?.result,privateCapabilitiesBound:out.structuredContent?.receipt?.privateCapabilitiesBound}});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const distinctAuthorizedResults=new Set(rows.map(r=>canonicalize(r.authorizedResult))).size;
const distinctObservations=new Set(rows.map(r=>canonicalize(r.observation))).size;
const result={schema:'hush.semantic-path-digest-correction.v1',frozenCohortSize:paths.length,distinctAuthorizedResults,distinctObservations,digestExposures:rows.filter(r=>r.hasDigest).length,rawPathExposures:rows.filter(r=>r.hasRawPath).length,gate:{resultsPreserved:distinctAuthorizedResults===1,noDigest:rows.every(r=>!r.hasDigest),noRawPath:rows.every(r=>!r.hasRawPath),fiberClosed:distinctObservations===1},rows};
process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
if(!Object.values(result.gate).every(Boolean)) process.exitCode=1;
