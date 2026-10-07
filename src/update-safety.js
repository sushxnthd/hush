import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MANIFEST='rollback-manifest.json';
const STATE='state';

function sha256(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function assertSafeTree(root){
  const out=[];
  function visit(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const full=path.join(dir,entry.name);
      if(entry.isSymbolicLink()) throw new Error(`Rollback state may not contain symbolic links: ${full}`);
      if(entry.isDirectory()) visit(full);
      else if(entry.isFile()) out.push(full);
      else throw new Error(`Unsupported rollback state entry: ${full}`);
    }
  }
  visit(root);
  return out;
}
function rel(root,file){return path.relative(root,file).split(path.sep).join('/');}
function sameOrNested(parent,child){
  const r=path.relative(path.resolve(parent),path.resolve(child));
  return r===''||(!r.startsWith('..')&&!path.isAbsolute(r));
}
function stateManifest(root){
  if(!fs.existsSync(root)) throw new Error('State directory does not exist');
  return assertSafeTree(root)
    .filter(file=>path.basename(file)!=='runtime.lock')
    .map(file=>({path:rel(root,file),bytes:fs.statSync(file).size,sha256:sha256(file)}));
}
function copyState(source,target){
  fs.mkdirSync(target,{recursive:true,mode:0o700});
  fs.cpSync(source,target,{recursive:true,force:false,errorOnExist:false,filter:(src)=>path.basename(src)!=='runtime.lock'});
}

export function createRollbackSnapshot({dataDir,snapshotDir,release=null}={}){
  const source=path.resolve(String(dataDir||''));
  const dest=path.resolve(String(snapshotDir||''));
  if(!dataDir||!snapshotDir) throw new Error('dataDir and snapshotDir are required');
  if(sameOrNested(source,dest)||sameOrNested(dest,source)) throw new Error('Rollback snapshot must be outside the live data directory');
  if(fs.existsSync(dest)) throw new Error('Rollback snapshot destination already exists');
  const files=stateManifest(source);
  const createdAt=new Date().toISOString();
  fs.mkdirSync(dest,{recursive:true,mode:0o700});
  copyState(source,path.join(dest,STATE));
  const manifest={schema:'hush.rollback-snapshot.v1',createdAt,release,files};
  fs.writeFileSync(path.join(dest,MANIFEST),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  const check=verifyRollbackSnapshot(dest);
  if(!check.valid) throw new Error(`Rollback snapshot verification failed: ${check.reason}`);
  return {snapshotDir:dest,manifest};
}

export function verifyRollbackSnapshot(snapshotDir){
  try{
    const root=path.resolve(String(snapshotDir||''));
    const manifest=JSON.parse(fs.readFileSync(path.join(root,MANIFEST),'utf8'));
    if(manifest.schema!=='hush.rollback-snapshot.v1'||!Array.isArray(manifest.files)) return {valid:false,reason:'invalid manifest'};
    const state=path.join(root,STATE);
    const actual=stateManifest(state);
    if(actual.length!==manifest.files.length) return {valid:false,reason:'file count mismatch'};
    for(let i=0;i<actual.length;i++){
      const a=actual[i],e=manifest.files[i];
      if(a.path!==e.path||a.bytes!==e.bytes||a.sha256!==e.sha256) return {valid:false,reason:`state mismatch: ${e.path??a.path}`};
    }
    return {valid:true,manifest};
  }catch(error){return {valid:false,reason:error?.message||String(error)};}
}

export function restoreRollbackSnapshot({snapshotDir,dataDir}={}){
  const snapshot=path.resolve(String(snapshotDir||''));
  const target=path.resolve(String(dataDir||''));
  if(!snapshotDir||!dataDir) throw new Error('snapshotDir and dataDir are required');
  if(sameOrNested(snapshot,target)||sameOrNested(target,snapshot)) throw new Error('Rollback snapshot and live data directory must be separate');
  const verified=verifyRollbackSnapshot(snapshot);
  if(!verified.valid) throw new Error(`Rollback snapshot is not valid: ${verified.reason}`);
  const nonce=crypto.randomBytes(8).toString('hex');
  const stage=`${target}.restore-${nonce}`;
  const failed=`${target}.failed-${nonce}`;
  try{
    copyState(path.join(snapshot,STATE),stage);
    const staged=stateManifest(stage);
    if(JSON.stringify(staged)!==JSON.stringify(verified.manifest.files)) throw new Error('Staged rollback state failed verification');
    if(fs.existsSync(target)) fs.renameSync(target,failed);
    fs.renameSync(stage,target);
    fs.rmSync(failed,{recursive:true,force:true});
    return {restored:true,files:staged.length,release:verified.manifest.release??null};
  }catch(error){
    fs.rmSync(stage,{recursive:true,force:true});
    if(!fs.existsSync(target)&&fs.existsSync(failed)) fs.renameSync(failed,target);
    throw error;
  }
}

export function hashStateDirectory(dataDir){
  return crypto.createHash('sha256').update(JSON.stringify(stateManifest(path.resolve(dataDir)))).digest('hex');
}
