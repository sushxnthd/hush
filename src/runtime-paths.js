import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function ensurePrivateDir(dir){
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  try{fs.chmodSync(dir,0o700);}catch{}
  return dir;
}

export function defaultHushDataDir({env=process.env,platform=process.platform,home=os.homedir()}={}){
  if(env.HUSH_DATA_DIR) return path.resolve(String(env.HUSH_DATA_DIR));
  if(platform==='win32'){
    const p=path.win32;
    return p.join(env.LOCALAPPDATA||p.join(home,'AppData','Local'),'Hush');
  }
  const p=path.posix;
  if(platform==='darwin') return p.join(home,'Library','Application Support','Hush');
  return p.join(env.XDG_DATA_HOME||p.join(home,'.local','share'),'hush');
}

function moveDirectory(source,target){
  fs.mkdirSync(path.dirname(target),{recursive:true});
  try{fs.renameSync(source,target);return 'rename';}
  catch(error){
    if(error?.code!=='EXDEV') throw error;
    fs.cpSync(source,target,{recursive:true,errorOnExist:true,force:false});
    fs.rmSync(source,{recursive:true,force:true});
    return 'copy-remove';
  }
}

/**
 * Resolve Hush's private runtime directory outside the application/source tree.
 * A legacy `<appRoot>/data` directory is moved once when the target does not yet
 * exist, preventing installed updates or source checkouts from owning user state.
 */
export function resolveHushDataDir({appRoot,env=process.env,platform=process.platform,home=os.homedir(),migrateLegacy=true}={}){
  if(!appRoot) throw new Error('appRoot is required');
  const target=defaultHushDataDir({env,platform,home});
  const legacy=path.join(path.resolve(appRoot),'data');
  let migration=null;
  if(migrateLegacy&&path.resolve(target)!==path.resolve(legacy)&&fs.existsSync(legacy)&&!fs.existsSync(target)){
    migration={from:legacy,to:target,method:moveDirectory(legacy,target)};
  }
  ensurePrivateDir(target);
  return {dataDir:target,migration};
}
