import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { certifyCumulativeAuthorization } from '../src/cumulative-authorization-contract.js';

const worlds = ['00', '01', '10', '11'];
const map = (fn) => Object.fromEntries(worlds.map((world) => [world, fn(...world.split('').map(Number))]));

test('rejects parity-vs-coordinate split approvals at the first offending call', () => {
  const result = certifyCumulativeAuthorization({
    worlds,
    globalAuthorization: map((x, y) => x ^ y),
    calls: [
      { id: 'x-call', localAuthorization: map((x) => x), observation: map((x) => x) },
      { id: 'y-call', localAuthorization: map((x, y) => y), observation: map((x, y) => y) },
    ],
  });
  assert.equal(result.locallySafe, true);
  assert.equal(result.universallyComposable, false);
  assert.equal(result.actualSafe, false);
  assert.equal(result.reason, 'GLOBAL_SCOPE_REFINEMENT');
  assert.deepEqual(result.witness, { left: '00', right: '11', call: 'x-call', prefix: 1 });
});

test('certifies calls whose local scopes factor through the global scope', () => {
  const parity = map((x, y) => x ^ y);
  const result = certifyCumulativeAuthorization({
    worlds,
    globalAuthorization: parity,
    calls: [
      { id: 'parity', localAuthorization: parity, observation: parity },
      { id: 'constant', localAuthorization: map(() => 0), observation: map(() => 'ok') },
    ],
  });
  assert.deepEqual(result, {
    safe: true, locallySafe: true, universallyComposable: true, actualSafe: true,
    reason: 'CERTIFIED', witness: null, actualWitness: null,
  });
});

test('distinguishes a latent scope violation from a harmless concrete release', () => {
  const result = certifyCumulativeAuthorization({
    worlds,
    globalAuthorization: map((x, y) => x ^ y),
    calls: [{ id: 'latent-x', localAuthorization: map((x) => x), observation: map(() => 0) }],
  });
  assert.equal(result.universallyComposable, false);
  assert.equal(result.actualSafe, true);
  assert.equal(result.safe, false);
});

test('rejects a call that violates its own local approval', () => {
  const result = certifyCumulativeAuthorization({
    worlds,
    globalAuthorization: map(() => 0),
    calls: [{ id: 'bad-local', localAuthorization: map(() => 0), observation: map((x) => x) }],
  });
  assert.equal(result.reason, 'LOCAL_AUTHORIZATION_VIOLATION');
  assert.equal(result.locallySafe, false);
});

test('matches every frozen eight-world prospective fixture', () => {
  const fixturePath = new URL('../research/pcc-runtime-product/cumulative-authorization-fixtures.json', import.meta.url);
  const frozen = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const toMap = (values) => Object.fromEntries(frozen.worlds.map((world, index) => [world, values[index]]));
  for (const fixture of frozen.fixtures) {
    const result = certifyCumulativeAuthorization({
      worlds: frozen.worlds,
      globalAuthorization: toMap(fixture.global),
      calls: fixture.calls.map((call) => ({
        id: call.id,
        localAuthorization: toMap(call.authorization),
        observation: toMap(call.observation),
      })),
    });
    assert.equal(result.universallyComposable, fixture.expected.universallyComposable, fixture.id);
    assert.equal(result.actualSafe, fixture.expected.actualSafe, fixture.id);
  }
});
