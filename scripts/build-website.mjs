import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {versionWebsiteAssets} from './version-website-assets.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await import('./write-product-site.mjs');
const media = path.join(root, 'assets/source/media');
const groups = new Map();
for (const filename of (await readdir(media)).sort()) {
  const match = /^(.*)\.part\d+\.b64$/.exec(filename);
  if (!match) continue;
  const parts = groups.get(match[1]) ?? [];
  parts.push(filename); groups.set(match[1], parts);
}
for (const [filename, parts] of groups) {
  const contents = (await Promise.all(parts.map(part => readFile(path.join(media, part), 'utf8')))).join('');
  await writeFile(path.join(media, filename), Buffer.from(contents, 'base64'));
}

// Publish only the website. The local runtime, test data and source packages are
// kept out of the Pages artifact; all runtime source remains in the repository.
const output = path.join(root, '.site-dist');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
const routes = ['product','writing','changelog','demo','app','docs','company','start','support','security','privacy','terms','research','research/context-boundary','research/private-decisions','pricing','mcp','coding-agents','responsible-disclosure'];
for (const route of routes) {
  await mkdir(path.join(output,route),{recursive:true});
  await cp(path.join(root,route,'index.html'),path.join(output,route,'index.html'));
}
// Only assets used by the current product site ship. Historical replica scripts
// and encoded source packages remain in the repo, outside the published bundle.
await mkdir(path.join(output,'assets/source/brand/media'),{recursive:true});
await mkdir(path.join(output,'assets/source/media'),{recursive:true});
for(const item of ['fonts','vendor','hush-logo.svg','favicon.svg','product-site.css','reference-site.css','reference-pages.css','product-site.js','workspace.css','workspace.js','workspace-core.js'])
  await cp(path.join(root,'assets',item),path.join(output,'assets',item),{recursive:true});
await cp(path.join(root,'assets/source/brand/plans'),path.join(output,'assets/source/brand/plans'),{recursive:true});
await cp(path.join(root,'assets/source/brand/deploy'),path.join(output,'assets/source/brand/deploy'),{recursive:true});
for(const file of ['field-still.webp','hush-dawn.webp'])
  await cp(path.join(root,'assets/source/brand/media',file),path.join(output,'assets/source/brand/media',file));
for(const filename of groups.keys())await cp(path.join(media,filename),path.join(output,'assets/source/media',filename));
for (const filename of ['index.html','index.md','sitemap.xml','robots.txt','.nojekyll']) {
  await cp(path.join(root, filename), path.join(output, filename));
}
await versionWebsiteAssets(output);
const pageCount=(await readdir(output,{recursive:true})).filter(n=>n.endsWith('index.html')).length;
console.log(`Website built: ${pageCount} routes, ${groups.size} preserved media files; assets versioned by content.`);
