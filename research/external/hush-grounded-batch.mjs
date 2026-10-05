import fs from 'node:fs';
import {guardGroundedOutboundValue} from '../../src/grounded-egress-guard.js';

const input=JSON.parse(fs.readFileSync(0,'utf8')||'{}');
const options={
  mode:String(input.mode||'pseudonymous'),
  minOverlapTokens:Number(input.minOverlapTokens??4),
  minCoverage:Number(input.minCoverage??0.62),
  minWeightedCoverage:Number(input.minWeightedCoverage??0.66),
  minJaccard:Number(input.minJaccard??0.18),
  minChars:Number(input.minChars??20),
  redactionStrategy:String(input.redactionStrategy||'surgical'),
  maskFraction:Number(input.maskFraction??0.4),
  minMaskTokens:Number(input.minMaskTokens??2),
  maxMaskTokens:Number(input.maxMaskTokens??6),
};
const results=(input.items??[]).map(item=>{
  const out=guardGroundedOutboundValue(item.content,{...options,protectedValues:item.protectedValues??[]});
  return {
    id:String(item.id),
    sanitized:out.sanitized,
    groundedMatches:out.groundedMatches,
    maxGroundedWeightedCoverage:out.maxGroundedWeightedCoverage,
    protectedProfileCount:out.protectedProfileCount,
    groundedRedactionStrategy:out.groundedRedactionStrategy,
  };
});
process.stdout.write(JSON.stringify({results}));
