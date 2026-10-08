#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {HushClient} from '../../src/client-sdk.js';
import {resolveHushDataDir} from '../../src/runtime-paths.js';
import {getOrCreatePlatformRootKey} from '../../src/platform-key-store.js';
import {deriveLocalControlToken,deriveMcpTransportToken} from '../../src/local-client-auth.js';
import {runtimePolicy} from '../../src/runtime-policy.js';
import {openLocalDashboard} from '../../src/dashboard-launch.js';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {dataDir}=resolveHushDataDir({appRoot});
const policy=runtimePolicy();
const rootKeyInfo=getOrCreatePlatformRootKey(dataDir,{production:policy.production});
const baseUrl=`http://127.0.0.1:${policy.port}`;
const client=new HushClient({baseUrl,authToken:deriveLocalControlToken(rootKeyInfo.key)});
const [command='status',...args]=process.argv.slice(2);

function print(value){ process.stdout.write(JSON.stringify(value,null,2)+'\n'); }
async function openDashboard(){
  const launch=await client.dashboardLaunch();
  await openLocalDashboard(launch.path,policy.port);
  return {opened:true,expiresAt:launch.expiresAt};
}

try{
  if(command==='status') print(await client.status());
  else if(command==='pending') print(await client.pending());
  else if(command==='footprint') print(await client.footprint());
  else if(command==='receipts') print(await client.receipts());
  else if(command==='approve'){
    if(!args[0]) throw new Error('Usage: hush-desktop approve <pending-id>');
    print(await client.approve(args[0]));
  }
  else if(command==='deny'){
    if(!args[0]) throw new Error('Usage: hush-desktop deny <pending-id>');
    print(await client.deny(args[0]));
  }
  else if(command==='redact'){
    const chunks=[];
    for await(const chunk of process.stdin) chunks.push(chunk);
    const text=Buffer.concat(chunks).toString('utf8');
    const out=await client.redact(text);
    process.stdout.write(String(out.redacted??'')+'\n');
  }
  else if(command==='mcp-token'){
    process.stdout.write(deriveMcpTransportToken(rootKeyInfo.key)+'\n');
  }
  else if(command==='doctor'){
    const status=await client.status();
    const checks={authenticated:status.security?.localClientAuth===true,osKeystore:status.security?.productionKeyStore===true,auditValid:status.security?.auditValid===true,privateContext:status.context?.enabled===true,singleInstance:status.runtime?.singleInstance===true};
    const ok=Object.values(checks).every(Boolean);
    print({product:'Hush',version:status.version,ready:ok,checks,providers:status.onboarding?.configured||{},scope:'Local runtime diagnostics; distribution and independent assurance are separate release gates.'});
    if(!ok)process.exitCode=1;
  }
  else if(command==='mcp-config'){
    print({mcpServers:{hush:{command:process.execPath,args:[path.join(appRoot,'clients','desktop','hush-mcp.mjs')],env:{PORT:String(policy.port),HUSH_DATA_DIR:dataDir,HUSH_MCP_AGENT:args[0]||'mcp-client'}}}});
  }
  else if(command==='dashboard') print(await openDashboard());
  else throw new Error('Commands: status, doctor, mcp-config [client-name], pending, footprint, receipts, approve <id>, deny <id>, redact, mcp-token, dashboard');
}catch(error){
  process.stderr.write(`Hush: ${error?.message||'command failed'}\n`);
  process.exitCode=1;
}
