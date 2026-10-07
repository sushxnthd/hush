#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {HushClient} from '../../src/client-sdk.js';
import {resolveHushDataDir} from '../../src/runtime-paths.js';
import {getOrCreatePlatformRootKey} from '../../src/platform-key-store.js';
import {deriveLocalControlToken,deriveMcpTransportToken} from '../../src/local-client-auth.js';

const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {dataDir}=resolveHushDataDir({appRoot});
const rootKeyInfo=getOrCreatePlatformRootKey(dataDir);
const client=new HushClient({authToken:deriveLocalControlToken(rootKeyInfo.key)});
const [command='status',...args]=process.argv.slice(2);

function print(value){ process.stdout.write(JSON.stringify(value,null,2)+'\n'); }
async function openDashboard(){
  const launch=await client.dashboardLaunch();
  const url=new URL(String(launch.path||'/'),'http://localhost:8787').toString();
  const spec=process.platform==='win32'?['cmd',['/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const child=spawn(spec[0],spec[1],{detached:true,stdio:'ignore'});
  child.unref();
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
  else if(command==='dashboard') print(await openDashboard());
  else throw new Error('Commands: status, pending, footprint, receipts, approve <id>, deny <id>, redact, mcp-token, dashboard');
}catch(error){
  process.stderr.write(`Hush: ${error?.message||'command failed'}\n`);
  process.exitCode=1;
}
