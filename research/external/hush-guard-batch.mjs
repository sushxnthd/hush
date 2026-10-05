import fs from 'node:fs';
import {guardOutboundValue} from '../../src/egress-guard.js';

const payload=JSON.parse(fs.readFileSync(0,'utf8')||'{}');
const items=Array.isArray(payload.items)?payload.items:[];
const mode=String(payload.mode||'pseudonymous');
const results=items.map(item=>{
  const out=guardOutboundValue(item.content,{
    protectedValues:Array.isArray(item.protectedValues)?item.protectedValues:[],
    mode,
    minTokens:Number(payload.minTokens??4),
    minChars:Number(payload.minChars??18)
  });
  return {id:String(item.id),sanitized:out.sanitized,protectedMatches:out.protectedMatches};
});
process.stdout.write(JSON.stringify({results}));
