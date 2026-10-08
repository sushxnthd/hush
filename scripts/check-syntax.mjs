import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let count=0;
for(const dir of ['src','clients','scripts','assets','public']){
  for(const rel of fs.readdirSync(path.join(root,dir),{recursive:true})){
    if(!/\.(js|mjs)$/.test(rel)||rel.split(path.sep).some(p=>['source','vendor'].includes(p)))continue;
    const file=path.join(root,dir,rel);
    if(!fs.statSync(file).isFile())continue;
    execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
    count++;
  }
}
console.log(`Syntax verified: ${count} JavaScript modules.`);
