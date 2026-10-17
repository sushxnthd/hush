import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
const canonical = value => JSON.stringify(stable(value), null, 2);
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
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
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error(`Hush did not start: ${stderr()}`);
}
function project(receipts) {
  return receipts.slice(0, 2).reverse().map(item => ({
    decision: item.decision,
    phase: item.result?.phase,
    status: item.result?.status ?? null,
    authorizationBasis: item.result?.authorizationBasis ?? null,
    upstreamStatus: item.result?.upstreamStatus ?? null,
    agent: item.request?.agent,
    purpose: item.request?.purpose,
    category: item.request?.category,
    action: item.request?.action,
    resource: item.request?.resource,
    transportMethod: item.request?.mcp?.transportMethod,
    credentialBrokered: item.result?.credentialBrokered,
    rawCredentialIncluded: item.result?.rawCredentialIncluded,
    signed: Boolean(item.signature)
  }));
}

async function withHush({ upstreamUrl, invoke }) {
  const hushPort = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-mcp-get-correction-'));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env, NODE_ENV: 'test', HUSH_ALLOW_FILE_KEY_FALLBACK: '1', HUSH_REQUIRE_LOCAL_AUTH: '0',
      PORT: String(hushPort), HUSH_DATA_DIR: dataDir, HUSH_MCP_UPSTREAM: upstreamUrl,
      HUSH_MCP_BEARER_TOKEN: 'server-only-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    const base = `http://127.0.0.1:${hushPort}`;
    await waitFor(`${base}/api/status`, child, () => stderr);
    return await invoke(base);
  } finally {
    if (child.exitCode == null) child.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

async function successfulScenario() {
  const observations = [];
  let hushBase = null;
  const frozenBody = 'event: endpoint\ndata: /messages?session=probe\n\n';
  const upstream = http.createServer(async (request, response) => {
    const atArrival = await (await fetch(`${hushBase}/api/receipts`)).json();
    observations.push({
      method: request.method,
      path: request.url,
      authorization: request.headers.authorization ?? null,
      receiptCountAtArrival: atArrival.receipts.length,
      chainValidAtArrival: atArrival.chainValid
    });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(frozenBody);
  });
  const upstreamPort = await listen(upstream);
  try {
    return await withHush({
      upstreamUrl: `http://127.0.0.1:${upstreamPort}/mcp`,
      invoke: async base => {
        hushBase = base;
        const before = await (await fetch(`${base}/api/receipts`)).json();
        const response = await fetch(`${base}/mcp?session=complete-mediation-probe`, {
          headers: {
            authorization: 'Bearer client-visible-token',
            'x-hush-agent': 'mediation-probe',
            'x-hush-purpose': 'frozen GET correction'
          }
        });
        const body = await response.text();
        const after = await (await fetch(`${base}/api/receipts`)).json();
        return {
          responseStatus: response.status,
          exactBodyForwarded: body === frozenBody,
          responseBoundToOutcome: response.headers.get('x-hush-receipt-hash') === after.receipts[0]?.hash,
          upstream: observations,
          receiptDelta: after.receipts.length - before.receipts.length,
          chainValid: after.chainValid,
          rawCredentialInReceipts: JSON.stringify(after.receipts).includes('server-only-secret'),
          receipts: project(after.receipts)
        };
      }
    });
  } finally {
    await new Promise(resolve => upstream.close(resolve));
  }
}

async function failureScenario() {
  const unreachablePort = await freePort();
  return withHush({
    upstreamUrl: `http://127.0.0.1:${unreachablePort}/mcp`,
    invoke: async base => {
      const before = await (await fetch(`${base}/api/receipts`)).json();
      const response = await fetch(`${base}/mcp?session=connection-failure`, {
        headers: { 'x-hush-agent': 'mediation-probe', 'x-hush-purpose': 'frozen GET failure closure' }
      });
      const payload = await response.json();
      const after = await (await fetch(`${base}/api/receipts`)).json();
      return {
        proxyErrorReturned: payload?.error?.code === -32603,
        receiptDelta: after.receipts.length - before.receipts.length,
        chainValid: after.chainValid,
        rawCredentialInReceipts: JSON.stringify(after.receipts).includes('server-only-secret'),
        receipts: project(after.receipts)
      };
    }
  });
}

const success = await successfulScenario();
const failure = await failureScenario();
const attemptPass = receipt => receipt?.decision === 'approved' && receipt?.phase === 'attempt' &&
  receipt?.authorizationBasis === 'configured_mcp_upstream' && receipt?.category === 'mcp-transport' &&
  receipt?.action === 'http_get' && receipt?.transportMethod === 'GET' && receipt?.signed === true &&
  receipt?.rawCredentialIncluded === false;
const result = {
  protocol: 'mcp-get-fail-closed-correction-v1', success, failure
};
result.allGatesPass = success.responseStatus === 200 && success.exactBodyForwarded &&
  success.upstream.length === 1 && success.upstream[0].authorization === 'Bearer server-only-secret' &&
  success.upstream[0].receiptCountAtArrival >= 1 && success.upstream[0].chainValidAtArrival === true &&
  success.receiptDelta === 2 && success.chainValid && success.responseBoundToOutcome &&
  !success.rawCredentialInReceipts && attemptPass(success.receipts[0]) &&
  success.receipts[1]?.decision === 'allow' && success.receipts[1]?.phase === 'outcome' &&
  success.receipts[1]?.upstreamStatus === 200 && success.receipts[1]?.signed === true &&
  failure.proxyErrorReturned && failure.receiptDelta === 2 && failure.chainValid &&
  !failure.rawCredentialInReceipts && attemptPass(failure.receipts[0]) &&
  failure.receipts[1]?.decision === 'error' && failure.receipts[1]?.phase === 'outcome' &&
  failure.receipts[1]?.status === 'error' && failure.receipts[1]?.signed === true;
result.scientificGate = result.allGatesPass ? 'PASS' : 'FAIL';
assert.equal(result.allGatesPass, true);
const payload = `${canonical(result)}\n`;
if (process.argv[2]) fs.writeFileSync(process.argv[2], payload);
process.stdout.write(payload);
