import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Pages caches static resources. Content versions prevent an older script or
// stylesheet or vector asset from being reused with a new release's HTML.
export async function versionWebsiteAssets(root){
  const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex').slice(0,16);
  const core=await hash(path.join(root,'assets/workspace-core.js'));
  const entry=path.join(root,'assets/workspace.js');
  await writeFile(entry,(await readFile(entry,'utf8')).replace("'./workspace-core.js'",`'./workspace-core.js?v=${core}'`));
  async function walk(dir){
    for(const item of await readdir(dir,{withFileTypes:true})){
      const file=path.join(dir,item.name);
      if(item.isDirectory()){await walk(file);continue;}
      if(!item.name.endsWith('.html'))continue;
      let html=await readFile(file,'utf8');
      const urls=new Set([...html.matchAll(/\b(?:href|src)="([^"#]+\.(?:js|css|svg)(?:\?[^"#]*)?)"/g)].map(m=>m[1]));
      for(const url of urls){
        if(/^(?:https?:|data:)/.test(url))continue;
        const clean=url.split('?')[0],target=path.resolve(path.dirname(file),clean);
        if(!target.startsWith(root+path.sep))throw Error('Asset path escapes website');
        html=html.split(`="${url}"`).join(`="${clean}?v=${await hash(target)}"`);
      }
      await writeFile(file,html);
    }
  }
  await walk(root);
}
