import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

test('MCP GET has pre-dispatch and terminal receipts', { timeout: 30_000 }, async () => {
  const { stdout } = await run(process.execPath, ['research/pcc-runtime-product/run_mcp_get_fail_closed_correction.mjs']);
  const result = JSON.parse(stdout);
  assert.equal(result.allGatesPass, true);
  assert.equal(result.scientificGate, 'PASS');
});
