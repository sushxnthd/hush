import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('.site-dist');
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=await walk(root),pages=files.filter(f=>f.endsWith('.html'));let checked=0;
for(const file of pages){
  const html=await readFile(file,'utf8'),relative=path.relative(root,file);
  assert.match(html,/<html\b[^>]*lang="en"/,relative+' language');assert.match(html,/<title>[^<]+<\/title>/,relative+' title');assert.match(html,/name="viewport"/,relative+' viewport');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,relative+' duplicate ids');
  for(const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)){
    const value=m[1];if(!value||/^(?:https?:|data:|mailto:)/.test(value))continue;
    const [raw,fragment]=value.split('#');const clean=raw.split('?')[0];let target=path.resolve(path.dirname(file),clean||path.basename(file));
    assert.ok(target===root||target.startsWith(root+path.sep),`${relative}: path escape ${value}`);
    if((await stat(target)).isDirectory())target=path.join(target,'index.html');
    await stat(target);checked++;
    if(/\.(?:js|css)$/.test(target)){
      const version=createHash('sha256').update(await readFile(target)).digest('hex').slice(0,16);
      assert.ok(value.endsWith('?v='+version),`${relative}: stale or missing asset version ${value}`);
    }
    // #sample is an explicit app state handled by workspace.js, not a scroll target.
    if(fragment&&target.endsWith('.html')&&!(target===path.join(root,'app/index.html')&&fragment==='sample')){const text=target===file?html:await readFile(target,'utf8');assert.ok(new RegExp(`\\bid=["']${fragment}["']`).test(text),`${relative}: missing anchor ${value}`);}
  }
}
const app=await readFile(path.join(root,'app/index.html'),'utf8');
const coreVersion=createHash('sha256').update(await readFile(path.join(root,'assets/workspace-core.js'))).digest('hex').slice(0,16);
assert.ok((await readFile(path.join(root,'assets/workspace.js'),'utf8')).includes(`'./workspace-core.js?v=${coreVersion}'`),'Workspace module dependency must be versioned');
assert.match(app,/connect-src 'none'/,'Workspace must have no remote connections');
assert.ok(!/<script(?![^>]*src=)[^>]*>[^<]+/i.test(app),'Workspace must have no inline scripts');
for(const f of files){const rel=path.relative(root,f).split(path.sep).join('/');assert.ok(!/(^|\/)(?:data|src|test|node_modules|runtime|release)\//.test(rel),'Runtime path deployed: '+rel);assert.ok(!rel.endsWith('.b64'),'Source package deployed: '+rel);}
for(const name of ['workspace.js','workspace-core.js']){const js=await readFile(path.join(root,'assets',name),'utf8');assert.ok(!/\bfetch\s*\(/.test(js),'Browser workspace must not make remote calls');assert.ok(!/localStorage/.test(js),'Browser workspace must not persist plaintext locally');}
console.log(`Website verified: ${pages.length} pages, ${checked} local references, isolated encrypted workspace.`);
