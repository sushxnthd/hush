import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}
const canonical = value => JSON.stringify(stable(value), null, 2);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

async function freePort() {
  const server = http.createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitFor(url, child, stderr) {
  for (let attempt = 0; attempt < 240; attempt += 1) {
    if (child.exitCode != null) throw Error(`Hush exited ${child.exitCode}: ${stderr()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`Hush did not start: ${stderr()}`);
}

async function run() {
  const observed = [];
  const upstream = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    observed.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization ?? null,
      bodyBytes: Buffer.concat(chunks).length
    });
    response.writeHead(204);
    response.end();
  });
  const upstreamPort = await listen(upstream);
  const hushPort = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-mcp-delete-probe-'));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HUSH_ALLOW_FILE_KEY_FALLBACK: '1',
      HUSH_REQUIRE_LOCAL_AUTH: '0',
      PORT: String(hushPort),
      HUSH_DATA_DIR: dataDir,
      HUSH_MCP_UPSTREAM: `http://127.0.0.1:${upstreamPort}/mcp`,
      HUSH_MCP_BEARER_TOKEN: 'server-only-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });

  try {
    const base = `http://127.0.0.1:${hushPort}`;
    await waitFor(`${base}/api/status`, child, () => stderr);
    const before = await (await fetch(`${base}/api/receipts`)).json();
    const response = await fetch(`${base}/mcp?session=probe`, {
      method: 'DELETE',
      headers: {
        authorization: 'Bearer client-visible-token',
        'x-hush-agent': 'mediation-probe',
        'x-hush-purpose': 'frozen complete-mediation falsification'
      }
    });
    const after = await (await fetch(`${base}/api/receipts`)).json();
    const result = {
      protocol: 'mcp-delete-complete-mediation-v1',
      request: { method: 'DELETE', path: '/mcp?session=probe' },
      responseStatus: response.status,
      upstreamObserved: observed,
      receiptCountBefore: before.receipts.length,
      receiptCountAfter: after.receipts.length,
      receiptDelta: after.receipts.length - before.receipts.length
    };
    result.bypassObserved = result.responseStatus === 204 &&
      observed.length === 1 && observed[0].method === 'DELETE' &&
      observed[0].path === '/mcp?session=probe' && result.receiptDelta === 0;
    result.scientificGate = result.bypassObserved ? 'FAIL' : 'PASS';
    result.smallestClaim = result.bypassObserved
      ? 'At this revision, authenticated MCP DELETE reaches the configured upstream without a Hush policy decision or receipt.'
      : 'The frozen MCP DELETE candidate did not demonstrate an unreceipted dispatch.';

    assert.equal(observed[0]?.authorization, 'Bearer server-only-secret');
    const payload = `${canonical(result)}\n`;
    const output = process.argv[2];
    if (output) fs.writeFileSync(output, payload);
    process.stdout.write(payload);
  } finally {
    if (child.exitCode == null) child.kill('SIGTERM');
    await new Promise(resolve => upstream.close(resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

await run();
