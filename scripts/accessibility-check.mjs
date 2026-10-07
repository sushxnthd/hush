import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['clients/browser/popup.html','clients/mobile/index.html'];
const report={schema:'hush.accessibility-static.v1',status:'pass',checkedAt:new Date().toISOString(),files:[],checks:0};
const fail=[];

function check(file,label,condition){
  report.checks++;
  if(!condition) fail.push(`${file}: ${label}`);
}

for(const file of files){
  const html=fs.readFileSync(file,'utf8');
  check(file,'document language',/<html\s+[^>]*lang=["'][a-z]{2}(?:-[A-Z]{2})?["']/i.test(html));
  check(file,'viewport meta',/<meta\s+[^>]*name=["']viewport["']/i.test(html));
  check(file,'page title',/<title>[^<]+<\/title>/i.test(html));
  check(file,'keyboard focus-visible styling',/:focus-visible\s*\{/i.test(html)||/:focus-visible[,\s]/i.test(html));
  check(file,'live status semantics',/aria-live=["'](?:polite|assertive)["']/i.test(html));
  check(file,'no positive tabindex',!(/tabindex=["'](?:[1-9]\d*)["']/i.test(html)));
  check(file,'no autofocus',!(/\sautofocus(?:\s|>|=)/i.test(html)));
  check(file,'no onclick-only static controls',!(/<(?:div|span)[^>]+onclick=/i.test(html)));
  check(file,'buttons have visible or aria text',![...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].some(m=>{
    const attrs=m[1],body=m[2].replace(/<[^>]+>/g,'').trim();
    return !body&&!/aria-label=["'][^"']+["']/i.test(attrs);
  }));
  const ids=[...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m=>m[1]);
  check(file,'unique ids',new Set(ids).size===ids.length);
  const labeledFor=new Set([...html.matchAll(/<label\b[^>]*for=["']([^"']+)["']/gi)].map(m=>m[1]));
  const textareas=[...html.matchAll(/<textarea\b([^>]*)>/gi)].map(m=>m[1]);
  check(file,'textareas have accessible labels',textareas.every(attrs=>{
    const id=attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
    return /aria-label=["'][^"']+["']/i.test(attrs)||(id&&labeledFor.has(id));
  }));
  report.files.push({file,bytes:Buffer.byteLength(html),ids:ids.length});
}

if(fail.length){
  report.status='fail';report.failures=fail;
  console.error(JSON.stringify(report,null,2));
  process.exitCode=1;
}else console.log(JSON.stringify(report,null,2));

fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/accessibility-static.json',JSON.stringify(report,null,2)+'\n');
assert.equal(report.status,'pass');
