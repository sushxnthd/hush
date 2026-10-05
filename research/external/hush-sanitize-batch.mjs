import fs from 'node:fs';
import {sanitizeContextValue} from '../../src/context-sanitizer.js';

const input=fs.readFileSync(0,'utf8');
const payload=JSON.parse(input||'{}');
const defaultMode=String(payload.mode||'pseudonymous');
const items=Array.isArray(payload.items)?payload.items:[];

const results=items.map(item=>{
  const mode=String(item.mode||defaultMode);
  const out=sanitizeContextValue(item.content,{mode});
  return {
    id:String(item.id),
    mode:out.mode,
    sanitized:out.sanitized,
    transformations:out.transformations,
    outputBytes:out.outputBytes,
    digest:out.digest
  };
});

process.stdout.write(JSON.stringify({results}));
