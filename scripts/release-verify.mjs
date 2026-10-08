import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const startedAt=new Date().toISOString();
const summaryPath=path.resolve('dist/release-summary.json');
let report;
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const norm=p=>p.split(path.sep).join('/');

try{
  const summary=JSON.parse(fs.readFileSync(summaryPath,'utf8'));
  const bundle=path.resolve(summary.bundle);
  const pkg=JSON.parse(fs.readFileSync(path.join(bundle,'package.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(bundle,'release-manifest.json'),'utf8'));
  const sbom=JSON.parse(fs.readFileSync(path.join(bundle,'sbom.spdx.json'),'utf8'));
  const sums=fs.readFileSync(path.join(bundle,'SHA256SUMS'),'utf8').trim().split('\n').filter(Boolean);

  assert.equal(manifest.schema,'hush.release-manifest.v1');
  assert.equal(manifest.version,pkg.version);
  assert.equal(typeof manifest.sourceDirty,'boolean','Candidate source cleanliness must be recorded');
  if(process.env.GITHUB_ACTIONS==='true')assert.equal(manifest.sourceDirty,false,'Hosted release candidate must be built from clean source');
  assert.equal(manifest.contentDigest,crypto.createHash('sha256').update(JSON.stringify(manifest.files)).digest('hex'),'Candidate inventory digest mismatch');
  assert.equal(sbom.spdxVersion,'SPDX-2.3');
  assert.equal(sbom.packages?.[0]?.versionInfo,pkg.version);
  assert.ok(manifest.bundledRuntime?.path,'Bundled runtime metadata is required');
  assert.equal(manifest.bundledRuntime.platform,process.platform,'Release runtime platform mismatch');
  assert.equal(manifest.bundledRuntime.arch,process.arch,'Release runtime architecture mismatch');
  const runtime=path.join(bundle,...manifest.bundledRuntime.path.split('/'));
  assert.equal(fs.existsSync(runtime),true,'Bundled Node runtime is missing');
  assert.equal(fs.statSync(runtime).size,manifest.bundledRuntime.bytes,'Bundled runtime size mismatch');
  assert.equal(sha256(runtime),manifest.bundledRuntime.sha256,'Bundled runtime hash mismatch');
  const bundledVersion=execFileSync(runtime,['--version'],{encoding:'utf8',timeout:10000,windowsHide:true}).trim();
  assert.equal(bundledVersion,manifest.bundledRuntime.nodeVersion,'Bundled Node runtime failed executable/version verification');
  const launcherNames=process.platform==='win32'?['launchers/hush.cmd','launchers/hush-dashboard.cmd','launchers/hush-mcp.cmd','launchers/hush-doctor.cmd','launchers/hush-open.cmd']:['launchers/hush','launchers/hush-dashboard','launchers/hush-mcp','launchers/hush-doctor','launchers/hush-open'];
  for(const rel of launcherNames){
    const file=path.join(bundle,...rel.split('/'));
    assert.equal(fs.existsSync(file),true,`Required launcher missing: ${rel}`);
    assert.match(fs.readFileSync(file,'utf8'),/NODE_ENV=production/,`Launcher must enforce production security: ${rel}`);
  }

  let checked=0;
  for(const line of sums){
    const match=line.match(/^([0-9a-f]{64})\s{2}(.+)$/i);
    assert.ok(match,`Malformed checksum line: ${line}`);
    const [,expected,rel]=match;
    const file=path.resolve(bundle,...rel.split('/'));
    const relative=path.relative(bundle,file);
    assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),`Checksum path escaped bundle: ${rel}`);
    assert.equal(sha256(file),expected,`Checksum mismatch: ${rel}`);
    checked++;
  }

  for(const item of manifest.files){
    const file=path.join(bundle,...String(item.path).split('/'));
    assert.equal(fs.statSync(file).size,item.bytes,`Manifest size mismatch: ${item.path}`);
    assert.equal(sha256(file),item.sha256,`Manifest hash mismatch: ${item.path}`);
  }
  for(const item of sbom.files??[]){
    const file=path.join(bundle,...String(item.fileName).split('/'));
    const expected=item.checksums?.find(x=>x.algorithm==='SHA256')?.checksumValue;
    assert.ok(expected,`SBOM SHA256 missing: ${item.fileName}`);
    assert.equal(sha256(file),expected,`SBOM hash mismatch: ${item.fileName}`);
  }

  const all=[];
  const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isSymbolicLink()) throw new Error(`Symlink forbidden in release bundle: ${p}`);if(entry.isDirectory())walk(p);else if(entry.isFile())all.push(norm(path.relative(bundle,p)));}};
  walk(bundle);
  const forbidden=[/(^|\/)\.env($|\.)/i,/(^|\/)master\.key$/i,/(^|\/)signing-private\.pem$/i,/(^|\/)vault\.json$/i,/(^|\/)authority-state\.json$/i,/(^|\/)runtime\.lock$/i];
  for(const file of all) for(const pattern of forbidden) assert.equal(pattern.test(file),false,`Private runtime material included in release bundle: ${file}`);

  report={schema:'hush.release-integrity.v1',status:'pass',startedAt,completedAt:new Date().toISOString(),version:pkg.version,commit:manifest.commit,platform:process.platform,arch:process.arch,bundledRuntime:{path:manifest.bundledRuntime.path,nodeVersion:bundledVersion,sha256:manifest.bundledRuntime.sha256},launchers:launcherNames,checksumEntries:checked,manifestEntries:manifest.files.length,sbomEntries:(sbom.files??[]).length,files:all.length,noSymlinks:true,noRuntimeSecrets:true,selfContainedRuntime:true};
}catch(error){
  report={schema:'hush.release-integrity.v1',status:'fail',startedAt,completedAt:new Date().toISOString(),error:error?.message||String(error)};
  process.exitCode=1;
}
fs.mkdirSync('dist/evidence',{recursive:true});
fs.writeFileSync('dist/evidence/release-integrity.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
