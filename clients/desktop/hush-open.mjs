#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {resolveHushDataDir} from '../../src/runtime-paths.js';
import {getOrCreatePlatformRootKey} from '../../src/platform-key-store.js';
import {deriveLocalControlToken} from '../../src/local-client-auth.js';
import {runtimePolicy} from '../../src/runtime-policy.js';
import {HushClient} from '../../src/client-sdk.js';
import {openLocalDashboard} from '../../src/dashboard-launch.js';

// A portable entry point: starts one authenticated runtime if needed, then opens
// a one-shot dashboard session. It never relaxes keystore or auth requirements.
try{
  const policy=runtimePolicy();
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const {dataDir}=resolveHushDataDir({appRoot:root});
  const key=getOrCreatePlatformRootKey(dataDir,{production:policy.production}).key;
  const client=new HushClient({baseUrl:`http://127.0.0.1:${policy.port}`,authToken:deriveLocalControlToken(key),timeoutMs:1000});
  let status;
  try{status=await client.status();}catch(error){if(error.status)throw new Error('The configured port is occupied by an unauthenticated or incompatible runtime.');}
  if(!status){
    const child=spawn(process.execPath,[path.join(root,'src','server.js')],{cwd:root,env:process.env,detached:true,stdio:'ignore',windowsHide:true});
    let failed=false;
    child.once('error',()=>{failed=true;});
    child.unref();
    for(let attempt=0;attempt<120&&!failed;attempt++){
      if(child.exitCode!==null)break;
      try{status=await client.status();break;}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!status)throw new Error('Hush did not start. Check the keystore, data-directory lock and loopback port; no security fallback was enabled.');
  }
  if(status.product!=='Hush'||!status.security?.localClientAuth||!status.security?.auditValid)throw new Error('Runtime security checks failed.');
  const launch=await client.dashboardLaunch();
  await openLocalDashboard(launch.path,policy.port);
  process.stdout.write('Hush dashboard opened. The local runtime stays available for your MCP clients.\n');
}catch(error){process.stderr.write(`Hush: ${error.message}\n`);process.exitCode=1;}
