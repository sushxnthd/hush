import assert from 'node:assert/strict';
import test from 'node:test';
import { TracePolicyMonitor, tracePolicyDecision, verifyTraceReceiptChain } from '../src/trace-policy-monitor.js';

test('matched intended output does not erase an unauthorized internal read', async () => {
  const policy = { allowedReads: ['profile:name'], allowedActions: ['calendar:list'] };
  const safe = new TracePolicyMonitor(policy);
  const unsafe = new TracePolicyMonitor(policy);
  let safeDispatches = 0;
  let unsafeDispatches = 0;

  const safeRead = await safe.execute({ type: 'read', name: 'profile:name' }, () => { safeDispatches += 1; return 'Ada'; });
  const unsafeRead = await unsafe.execute({ type: 'read', name: 'vault:api-key' }, () => { unsafeDispatches += 1; return 'secret'; });

  assert.equal(safeRead.dispatched, true);
  assert.equal(unsafeRead.dispatched, false);
  assert.equal(safeDispatches, 1);
  assert.equal(unsafeDispatches, 0);
  assert.deepEqual({ intendedOutput: 'hello' }, { intendedOutput: 'hello' });
});

test('matched full-trace semantic control equals the monitor decision', () => {
  const policy = { allowedReads: ['r0', 'r2'], allowedActions: ['a1'] };
  for (const event of [
    { type: 'read', name: 'r0' }, { type: 'read', name: 'r1' },
    { type: 'action', name: 'a1' }, { type: 'action', name: 'a2' },
    { type: 'release', value: 0 }
  ]) {
    const monitor = new TracePolicyMonitor(policy, { failClosed: false });
    assert.equal(monitor.authorize(event).decision, tracePolicyDecision(policy, event).decision);
  }
});

test('monitor locks after denial and never dispatches later effects', async () => {
  const monitor = new TracePolicyMonitor({ allowedReads: ['r0'], allowedActions: ['a0'] });
  let dispatches = 0;
  await monitor.execute({ type: 'read', name: 'r1' }, () => { dispatches += 1; });
  const later = await monitor.execute({ type: 'action', name: 'a0' }, () => { dispatches += 1; });
  assert.equal(later.dispatched, false);
  assert.equal(dispatches, 0);
});

test('receipt chain binds every attempted event and decision', () => {
  const monitor = new TracePolicyMonitor({ allowedReads: ['r0'], allowedActions: [] }, { failClosed: false });
  monitor.authorize({ type: 'read', name: 'r0' });
  monitor.authorize({ type: 'action', name: 'a0' });
  monitor.authorize({ type: 'release', value: 1 });
  const receipts = monitor.exportReceipts();
  assert.equal(verifyTraceReceiptChain(receipts), true);

  for (const mutate of [
    xs => { xs[0].event.name = 'r1'; },
    xs => { xs[1].decision = 'allow'; },
    xs => { xs[2].previousHash = '0'.repeat(64); }
  ]) {
    const tampered = structuredClone(receipts);
    mutate(tampered);
    assert.equal(verifyTraceReceiptChain(tampered), false);
  }
});
