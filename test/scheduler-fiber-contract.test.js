import assert from 'node:assert/strict';
import test from 'node:test';
import { certifySchedulerFiberComposition } from '../src/scheduler-fiber-contract.js';

const worlds = ['low0', 'low1', 'high0', 'high1'];
const authorization = { low0: 'low', low1: 'low', high0: 'high', high1: 'high' };
const componentEvents = {
  A: { low0: 0, low1: 0, high0: 1, high1: 1 },
  B: { low0: 1, low1: 1, high0: 0, high1: 0 },
};

test('certifies public scheduler choices over safe components', () => {
  const schedules = Object.fromEntries(worlds.map((world) => [world, ['A', 'B']]));
  assert.deepEqual(certifySchedulerFiberComposition({ worlds, authorization, componentEvents, schedules }), {
    safe: true, componentSafe: true, schedulerSafe: true, reason: 'CERTIFIED', witness: null,
  });
});

test('rejects hidden-bit-dependent order at the first emitted prefix', () => {
  const schedules = {
    low0: ['A', 'B'], low1: ['B', 'A'], high0: ['A', 'B'], high1: ['B', 'A'],
  };
  const result = certifySchedulerFiberComposition({ worlds, authorization, componentEvents, schedules });
  assert.equal(result.safe, false);
  assert.equal(result.componentSafe, true);
  assert.equal(result.reason, 'SCHEDULER_FIBER_VIOLATION');
  assert.equal(result.witness.prefix, 1);
});

test('rejects unsafe components before considering the scheduler', () => {
  const unsafeEvents = structuredClone(componentEvents);
  unsafeEvents.A.low1 = 1;
  const schedules = Object.fromEntries(worlds.map((world) => [world, ['A', 'B']]));
  const result = certifySchedulerFiberComposition({ worlds, authorization, componentEvents: unsafeEvents, schedules });
  assert.equal(result.reason, 'COMPONENT_FIBER_VIOLATION');
  assert.equal(result.componentSafe, false);
});
