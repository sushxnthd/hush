#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveHushDataDir} from '../../src/runtime-paths.js';
import {getOrCreatePlatformRootKey} from '../../src/platform-key-store.js';
import {deriveMcpTransportToken} from '../../src/local-client-auth.js';
import {runtimePolicy} from '../../src/runtime-policy.js';
import {runStdioTransport} from '../../src/mcp-stdio-transport.js';

try{
  const policy=runtimePolicy();
  const appRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
  const {dataDir}=resolveHushDataDir({appRoot});
  const root=getOrCreatePlatformRootKey(dataDir,{production:policy.production});
  const controller=new AbortController();
  const stop=()=>{controller.abort();process.stdin.destroy();};
  process.once('SIGINT',stop);
  process.once('SIGTERM',stop);
  await runStdioTransport({input:process.stdin,output:process.stdout,endpoint:`http://127.0.0.1:${policy.port}/mcp`,token:deriveMcpTransportToken(root.key),agent:process.env.HUSH_MCP_AGENT||'mcp-client',signal:controller.signal});
}catch{
  // stdout belongs exclusively to MCP messages. Credentials never go to logs.
  process.stderr.write('Hush MCP could not start or the input exceeded its safety limit. Check runtime setup and the OS keystore.\n');
  process.exitCode=1;
}
