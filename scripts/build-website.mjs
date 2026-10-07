import { readdir, readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const routes = ['product','writing','changelog','demo','start','support','security','privacy','terms'];
for (const route of routes) await cp(path.join(root, route), path.join(output, route), {recursive:true});
await cp(path.join(root, 'assets'), path.join(output, 'assets'), {
  recursive:true,
  filter: source => !source.endsWith('.b64')
});
for (const filename of ['index.html','index.md','product.md','research.md','changelog.md','sitemap.xml','.nojekyll']) {
  await cp(path.join(root, filename), path.join(output, filename));
}
console.log(`Website built: ${routes.length + 1} routes, ${groups.size} preserved media files.`);
