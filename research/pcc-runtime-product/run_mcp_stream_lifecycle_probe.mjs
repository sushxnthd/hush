import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const stable = value => Array.isArray(value) ? value.map(stable) :
  value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
const canonical = value => `${JSON.stringify(stable(value), null, 2)}\n`;

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
  for (let i = 0; i < 240; i += 1) {
    if (child.exitCode != null) throw Error(`Hush exited ${child.exitCode}: ${stderr()}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await sleep(50);
  }
  throw Error(`Hush did not start: ${stderr()}`);
}
function project(payload) {
  return payload.receipts.slice().reverse()
    .filter(item => item.request?.action === 'http_get')
    .map(item => ({
      decision: item.decision,
      phase: item.result?.phase ?? null,
      status: item.result?.status ?? null,
      streamTerminal: item.result?.streamTerminal ?? null,
      upstreamStatus: item.result?.upstreamStatus ?? null,
      authorizationBasis: item.result?.authorizationBasis ?? null,
      signed: Boolean(item.signature),
      rawCredentialIncluded: item.result?.rawCredentialIncluded ?? null
    }));
}
async function closeServer(server, sockets) {
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => server.close(resolve));
}

async function scenario(mode) {
  const sockets = new Set();
  const arrival = [];
  let hushBase = null;
  let upstreamClientClosed = false;
  const upstream = http.createServer(async (request, response) => {
    const atArrival = await (await fetch(`${hushBase}/api/receipts`)).json();
    arrival.push({
      method: request.method,
      authorizationBrokered: request.headers.authorization === 'Bearer server-only-secret',
      receiptCount: project(atArrival).length,
      chainValid: atArrival.chainValid
    });
    request.on('close', () => { upstreamClientClosed = true; });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.write('event: message\ndata: first\n\n');
    if (mode === 'clean_eof') {
      await sleep(40);
      response.end('event: message\ndata: second\n\n');
    } else if (mode === 'upstream_abort') {
      await sleep(40);
      response.destroy(new Error('frozen upstream body failure'));
    }
  });
  upstream.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  const upstreamPort = await listen(upstream);
  const hushPort = await freePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), `hush-stream-${mode}-`));
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env, NODE_ENV: 'test', HUSH_ALLOW_FILE_KEY_FALLBACK: '1', HUSH_REQUIRE_LOCAL_AUTH: '0',
      PORT: String(hushPort), HUSH_DATA_DIR: dataDir,
      HUSH_MCP_UPSTREAM: `http://127.0.0.1:${upstreamPort}/mcp`,
      HUSH_MCP_BEARER_TOKEN: 'server-only-secret'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  try {
    hushBase = `http://127.0.0.1:${hushPort}`;
    await waitFor(`${hushBase}/api/status`, child, () => stderr);
    const before = await (await fetch(`${hushBase}/api/receipts`)).json();
    let responseStatus = null;
    let delivered = '';
    let clientTerminal = null;
    let firstSnapshot = null;
    await new Promise((resolve, reject) => {
      const request = http.get(`${hushBase}/mcp?session=${mode}`, {
        headers: {
          authorization: 'Bearer client-visible-token',
          'x-hush-agent': 'stream-lifecycle-probe',
          'x-hush-purpose': `frozen ${mode}`
        }
      });
      request.on('response', response => {
        responseStatus = response.statusCode;
        response.on('data', async chunk => {
          delivered += chunk.toString();
          if (!firstSnapshot) {
            const snapshot = await (await fetch(`${hushBase}/api/receipts`)).json();
            firstSnapshot = { receipts: project(snapshot), chainValid: snapshot.chainValid };
            if (mode === 'client_cancel') {
              clientTerminal = 'cancelled';
              response.destroy();
              request.destroy();
              resolve();
            }
          }
        });
        response.on('end', () => { clientTerminal = 'complete'; resolve(); });
        response.on('aborted', () => { clientTerminal = clientTerminal ?? 'aborted'; resolve(); });
        response.on('error', () => { clientTerminal = clientTerminal ?? 'error'; resolve(); });
      });
      request.on('error', error => {
        if (mode === 'client_cancel') resolve();
        else if (responseStatus != null) { clientTerminal = clientTerminal ?? 'error'; resolve(); }
        else reject(error);
      });
    });
    await sleep(180);
    const after = await (await fetch(`${hushBase}/api/receipts`)).json();
    const terminalProjection = project(after);
    return {
      mode,
      responseStatus,
      firstEventDelivered: delivered.includes('data: first'),
      secondEventDelivered: delivered.includes('data: second'),
      clientTerminal,
      upstreamClientClosed,
      upstreamArrival: arrival,
      receiptDelta: after.receipts.length - before.receipts.length,
      firstSnapshot,
      terminalSnapshot: { receipts: terminalProjection, chainValid: after.chainValid },
      rawBrokeredCredentialInReceipts: JSON.stringify(after.receipts).includes('server-only-secret'),
      hasLifecycleTerminal: terminalProjection.some(item => ['complete', 'error', 'cancelled'].includes(item.streamTerminal))
    };
  } finally {
    if (child.exitCode == null) child.kill('SIGTERM');
    await closeServer(upstream, sockets);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

const scenarios = [];
for (const mode of ['clean_eof', 'upstream_abort', 'client_cancel']) scenarios.push(await scenario(mode));
const [clean, failed, cancelled] = scenarios;
const receiptsIndistinguishable = new Set(scenarios.map(item => JSON.stringify(item.terminalSnapshot.receipts))).size === 1;
const counterexample =
  scenarios.every(item => item.upstreamArrival.length === 1 && item.upstreamArrival[0].receiptCount >= 1 && item.upstreamArrival[0].chainValid) &&
  scenarios.every(item => item.firstEventDelivered && item.receiptDelta === 2 && item.terminalSnapshot.chainValid) &&
  scenarios.every(item => !item.rawBrokeredCredentialInReceipts) &&
  clean.clientTerminal === 'complete' && failed.clientTerminal !== 'complete' && cancelled.clientTerminal === 'cancelled' &&
  scenarios.every(item => !item.hasLifecycleTerminal) && receiptsIndistinguishable;
const result = {
  protocol: 'hush.mcp-stream-lifecycle.v1',
  classification: 'REAL_SERVER_ADVERSARIAL_TRANSPORT_TEST',
  scenarios,
  receiptsIndistinguishable,
  counterexample,
  scientificGate: counterexample ? 'FALSIFIED_TERMINAL_STREAM_CLOSURE' : 'NO_COUNTEREXAMPLE',
  smallestClaim: counterexample
    ? 'The current GET outcome receipt certifies upstream response headers, not stream completion: clean EOF, upstream body failure, and client cancellation leave indistinguishable receipts.'
    : 'The frozen lifecycle counterexample did not reproduce.'
};
const output = canonical(result);
if (process.argv[2]) fs.writeFileSync(process.argv[2], output);
process.stdout.write(output);
assert.equal(counterexample, true);
