import {spawn} from 'node:child_process';
export function dashboardUrl(path,port){
  const base=`http://127.0.0.1:${port}`;
  const url=new URL(String(path),base);
  if(url.origin!==base||!/^\/dashboard\/bootstrap\/[A-Za-z0-9_-]+$/.test(url.pathname)||url.search||url.hash)throw new Error('Invalid dashboard launch path');
  url.hostname='localhost';
  return url.toString();
}
export async function openLocalDashboard(path,port,{spawnImpl=spawn,platform=process.platform}={}){
  const url=dashboardUrl(path,port);
  const spec=platform==='win32'?['cmd',['/c','start','',url]]:platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const child=spawnImpl(spec[0],spec[1],{detached:true,stdio:'ignore',windowsHide:true});
  await new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('Could not open the dashboard. Check the system browser launcher.')));child.once('spawn',resolve);});
  child.unref();
}
