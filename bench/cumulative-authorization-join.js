import fs from 'node:fs';
import { certifyCumulativeAuthorization } from '../src/cumulative-authorization-contract.js';

const bits = (n) => Array.from({ length: 16 }, (_, mask) =>
  Object.fromEntries(Array.from({ length: n }, (__, index) => [String(index), (mask >> index) & 1])));
const worlds = ['0', '1', '2', '3'];
const maps = bits(4);

function same(map, left, right) {
  return map[left] === map[right];
}

function factors(observation, authorization) {
  for (let i = 0; i < worlds.length; i += 1) {
    for (let j = i + 1; j < worlds.length; j += 1) {
      if (same(authorization, worlds[i], worlds[j]) && !same(observation, worlds[i], worlds[j])) return false;
    }
  }
  return true;
}

function jointlySafe(global, left, right) {
  for (let i = 0; i < worlds.length; i += 1) {
    for (let j = i + 1; j < worlds.length; j += 1) {
      if (same(global, worlds[i], worlds[j]) &&
          (!same(left, worlds[i], worlds[j]) || !same(right, worlds[i], worlds[j]))) return false;
    }
  }
  return true;
}

const locallySafe = new Map(maps.map((authorization, index) =>
  [index, maps.filter((observation) => factors(observation, authorization))]));

let authorizationSystems = 0;
let universallyComposable = 0;
let oracleSafeObservationPairs = 0;
let oracleObservationPairs = 0;
let disagreements = 0;

for (let g = 0; g < maps.length; g += 1) {
  for (let a = 0; a < maps.length; a += 1) {
    for (let b = 0; b < maps.length; b += 1) {
      authorizationSystems += 1;
      const structural = certifyCumulativeAuthorization({
        worlds,
        globalAuthorization: maps[g],
        calls: [
          { id: 'a', localAuthorization: maps[a], observation: maps[a] },
          { id: 'b', localAuthorization: maps[b], observation: maps[b] },
        ],
      }).universallyComposable;
      let oracle = true;
      for (const left of locallySafe.get(a)) {
        for (const right of locallySafe.get(b)) {
          oracleObservationPairs += 1;
          if (jointlySafe(maps[g], left, right)) oracleSafeObservationPairs += 1;
          else oracle = false;
        }
      }
      if (structural) universallyComposable += 1;
      if (structural !== oracle) disagreements += 1;
    }
  }
}

const fixturePath = new URL('../research/pcc-runtime-product/cumulative-authorization-fixtures.json', import.meta.url);
const frozen = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const fixtureResults = frozen.fixtures.map((fixture) => {
  const toMap = (values) => Object.fromEntries(frozen.worlds.map((world, index) => [world, values[index]]));
  const result = certifyCumulativeAuthorization({
    worlds: frozen.worlds,
    globalAuthorization: toMap(fixture.global),
    calls: fixture.calls.map((call) => ({
      id: call.id,
      localAuthorization: toMap(call.authorization),
      observation: toMap(call.observation),
    })),
  });
  const passed = result.universallyComposable === fixture.expected.universallyComposable &&
    result.actualSafe === fixture.expected.actualSafe;
  return { id: fixture.id, passed, expected: fixture.expected, result };
});

const output = {
  schemaVersion: 1,
  theorem: 'ker(G) subset intersection_i ker(A_i)',
  exactEnumeration: {
    worlds: worlds.length,
    binaryMaps: maps.length,
    authorizationSystems,
    universallyComposable,
    notUniversallyComposable: authorizationSystems - universallyComposable,
    oracleObservationPairs,
    oracleSafeObservationPairs,
    disagreements,
  },
  frozenFixtures: {
    seed: frozen.seed,
    total: fixtureResults.length,
    passed: fixtureResults.filter((result) => result.passed).length,
    results: fixtureResults,
  },
  gate: disagreements === 0 && fixtureResults.every((result) => result.passed) ? 'PASS' : 'FAIL',
};

if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
else console.log(output);

if (output.gate !== 'PASS') process.exitCode = 1;
