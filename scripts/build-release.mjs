import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

await import('./build-dashboard.mjs');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const dist=path.join(root,'dist');
const bundle=path.join(dist,`hush-${pkg.version}-portable`);
const includeDirs=['src','public','clients'];
const includeFiles=['package.json','README.md','SECURITY.md','SUPPORT.md','PRIVACY.md','TERMS.md','INCIDENT_RESPONSE.md','THREAT_MODEL.md','ARCHITECTURE.md','V1_2_ACCEPTANCE.md'];

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function normalizedRel(file){return path.relative(bundle,file).split(path.sep).join('/');}
function walk(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory()) out.push(...walk(p));
    else if(entry.isFile()) out.push(p);
  }
  return out;
}
function copyTree(source,target){
  fs.mkdirSync(target,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const from=path.join(source,entry.name),to=path.join(target,entry.name);
    if(entry.isDirectory()) copyTree(from,to);
    else if(entry.isFile()) fs.copyFileSync(from,to);
  }
}
function gitSha(){
  if(process.env.GITHUB_SHA) return String(process.env.GITHUB_SHA);
  try{return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}
  catch{return null;}
}
function sourceEpoch(){
  const raw=Number(process.env.SOURCE_DATE_EPOCH||0);
  return Number.isFinite(raw)&&raw>0?new Date(raw*1000).toISOString():null;
}
function writeExecutable(file,content){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,content,{mode:0o755});
  try{fs.chmodSync(file,0o755);}catch{}
}
function bundleRuntime(){
  const runtimeDir=path.join(bundle,'runtime');
  fs.mkdirSync(runtimeDir,{recursive:true});
  const runtimeName=process.platform==='win32'?'node.exe':'node';
  const target=path.join(runtimeDir,runtimeName);
  fs.copyFileSync(process.execPath,target);
  try{fs.chmodSync(target,0o755);}catch{}
  const launcherDir=path.join(bundle,'launchers');
  fs.mkdirSync(launcherDir,{recursive:true});
  if(process.platform==='win32'){
    fs.writeFileSync(path.join(launcherDir,'hush.cmd'),'@echo off\r\nsetlocal\r\n"%~dp0..\\runtime\\node.exe" "%~dp0..\\src\\server.js" %*\r\n');
    fs.writeFileSync(path.join(launcherDir,'hush-dashboard.cmd'),'@echo off\r\nsetlocal\r\n"%~dp0..\\runtime\\node.exe" "%~dp0..\\clients\\desktop\\hush-desktop.mjs" dashboard\r\n');
  }else{
    writeExecutable(path.join(launcherDir,'hush'),'#!/bin/sh\nset -eu\nROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"\nexec "$ROOT/runtime/node" "$ROOT/src/server.js" "$@"\n');
    writeExecutable(path.join(launcherDir,'hush-dashboard'),'#!/bin/sh\nset -eu\nROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"\nexec "$ROOT/runtime/node" "$ROOT/clients/desktop/hush-desktop.mjs" dashboard\n');
  }
  return {path:normalizedRel(target),sha256:sha256(target),bytes:fs.statSync(target).size,nodeVersion:process.version,platform:process.platform,arch:process.arch};
}

fs.rmSync(dist,{recursive:true,force:true});
fs.mkdirSync(bundle,{recursive:true});
for(const dir of includeDirs){
  const source=path.join(root,dir);
  if(!fs.existsSync(source)) throw new Error(`Release source missing: ${dir}`);
  copyTree(source,path.join(bundle,dir));
}
for(const file of includeFiles){
  const source=path.join(root,file);
  if(fs.existsSync(source)) fs.copyFileSync(source,path.join(bundle,file));
}
const bundledRuntime=bundleRuntime();

const initialFiles=walk(bundle);
const inventory=initialFiles.map(file=>({path:normalizedRel(file),sha256:sha256(file),bytes:fs.statSync(file).size}));
const releaseManifest={
  schema:'hush.release-manifest.v1',
  product:'Hush',
  version:pkg.version,
  commit:gitSha(),
  sourceDate:sourceEpoch(),
  nodeEngine:pkg.engines?.node??null,
  bundledRuntime,
  dependencyCount:Object.keys(pkg.dependencies??{}).length+Object.keys(pkg.optionalDependencies??{}).length,
  files:inventory
};
fs.writeFileSync(path.join(bundle,'release-manifest.json'),JSON.stringify(releaseManifest,null,2)+'\n');

const allBeforeSbom=walk(bundle);
const spdxFiles=allBeforeSbom.map((file,index)=>({
  SPDXID:`SPDXRef-File-${index+1}`,
  fileName:normalizedRel(file),
  checksums:[{algorithm:'SHA256',checksumValue:sha256(file)}]
}));
const sbom={
  spdxVersion:'SPDX-2.3',
  dataLicense:'CC0-1.0',
  SPDXID:'SPDXRef-DOCUMENT',
  name:`Hush ${pkg.version} portable release`,
  documentNamespace:`https://hush.local/spdx/${pkg.version}/${releaseManifest.commit||'unknown'}/${process.platform}-${process.arch}`,
  creationInfo:{created:sourceEpoch()||'1970-01-01T00:00:00.000Z',creators:['Tool: Hush release builder']},
  packages:[{
    SPDXID:'SPDXRef-Package-Hush',name:'hush',versionInfo:pkg.version,downloadLocation:'NOASSERTION',filesAnalyzed:true,
    packageVerificationCode:{packageVerificationCodeValue:crypto.createHash('sha1').update(spdxFiles.map(x=>x.checksums[0].checksumValue).sort().join('')).digest('hex')}
  }],
  files:spdxFiles,
  relationships:spdxFiles.map(file=>({spdxElementId:'SPDXRef-Package-Hush',relationshipType:'CONTAINS',relatedSpdxElement:file.SPDXID}))
};
fs.writeFileSync(path.join(bundle,'sbom.spdx.json'),JSON.stringify(sbom,null,2)+'\n');

const finalFiles=walk(bundle).filter(file=>path.basename(file)!=='SHA256SUMS');
const sums=finalFiles.map(file=>`${sha256(file)}  ${normalizedRel(file)}`).join('\n')+'\n';
fs.writeFileSync(path.join(bundle,'SHA256SUMS'),sums);

for(const line of sums.trim().split('\n')){
  const [expected,...parts]=line.split(/\s+/);
  const rel=parts.join(' ');
  const actual=sha256(path.join(bundle,...rel.split('/')));
  if(actual!==expected) throw new Error(`Release checksum verification failed: ${rel}`);
}

const summary={bundle:path.relative(root,bundle),version:pkg.version,commit:releaseManifest.commit,platform:process.platform,arch:process.arch,bundledNodeVersion:process.version,bundledRuntime:bundledRuntime.path,files:walk(bundle).length,sbom:'sbom.spdx.json',checksums:'SHA256SUMS'};
fs.writeFileSync(path.join(dist,'release-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
