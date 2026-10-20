import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  canonicalFinalMultiset,
  certifySchedulerFiberComposition,
  taggedTrace,
} from '../../src/scheduler-fiber-contract.js';

const outputIndex = process.argv.indexOf('--output');
const output = outputIndex >= 0 ? process.argv[outputIndex + 1] :
  new URL('./scheduler_fiber_composition_result.json', import.meta.url);
const worlds = ['p0h0', 'p0h1', 'p1h0', 'p1h1'];
const authorization = { p0h0: 0, p0h1: 0, p1h0: 1, p1h1: 1 };
const orders = [['A', 'B'], ['B', 'A']];

function bitFunction(mask) {
  return { 0: mask & 1, 1: (mask >> 1) & 1 };
}

function scheduleFunction(mask) {
  return Object.fromEntries(worlds.map((world, index) => [world, orders[(mask >> index) & 1]]));
}

let systems = 0;
let finalMultisetSafe = 0;
let orderedPrefixSafe = 0;
let schedulerFiberSafe = 0;
let leaks = 0;
let criterionDisagreements = 0;
let firstLeak = null;

for (let aMask = 0; aMask < 4; aMask += 1) {
  for (let bMask = 0; bMask < 4; bMask += 1) {
    const a = bitFunction(aMask);
    const b = bitFunction(bMask);
    const componentEvents = {
      A: Object.fromEntries(worlds.map((world) => [world, a[authorization[world]]])),
      B: Object.fromEntries(worlds.map((world) => [world, b[authorization[world]]])),
    };
    for (let schedulerMask = 0; schedulerMask < 16; schedulerMask += 1) {
      systems += 1;
      const schedules = scheduleFunction(schedulerMask);
      const certificate = certifySchedulerFiberComposition({ worlds, authorization, componentEvents, schedules });
      const fiberSafe = schedules.p0h0[0] === schedules.p0h1[0] &&
        schedules.p1h0[0] === schedules.p1h1[0];
      schedulerFiberSafe += Number(fiberSafe);
      orderedPrefixSafe += Number(certificate.safe);
      leaks += Number(!certificate.safe);
      criterionDisagreements += Number(certificate.safe !== fiberSafe);

      const finalSafe = [['p0h0', 'p0h1'], ['p1h0', 'p1h1']].every(([left, right]) =>
        JSON.stringify(canonicalFinalMultiset(left, componentEvents, schedules[left])) ===
        JSON.stringify(canonicalFinalMultiset(right, componentEvents, schedules[right])));
      finalMultisetSafe += Number(finalSafe);

      if (!certificate.safe && firstLeak === null) {
        const { left, right, prefix } = certificate.witness;
        firstLeak = {
          componentEvents,
          schedulerMask,
          witness: certificate.witness,
          leftTrace: taggedTrace(left, componentEvents, schedules[left]).slice(0, prefix),
          rightTrace: taggedTrace(right, componentEvents, schedules[right]).slice(0, prefix),
          finalCanonicalEqual: finalSafe,
        };
      }
    }
  }
}

const core = {
  protocol: 'scheduler-fiber-composition-v1',
  model: {
    worlds: 4,
    authorizationFibers: [["p0h0", "p0h1"], ["p1h0", "p1h1"]],
    components: 2,
    observableComponentTags: true,
    componentPayloadFunctions: 16,
    schedulerFunctions: 16,
  },
  prediction: {
    systems: 256,
    finalMultisetSafe: 256,
    orderedPrefixSafe: 64,
    leaks: 192,
    criterionDisagreements: 0,
  },
  observed: { systems, finalMultisetSafe, orderedPrefixSafe, schedulerFiberSafe, leaks, criterionDisagreements },
  firstLeak,
  scientificGate: criterionDisagreements === 0 && orderedPrefixSafe === 64 && leaks === 192
    ? 'SURVIVE_SCHEDULER_FIBER_LAW'
    : 'KILL_SCHEDULER_FIBER_LAW',
};
const canonical = JSON.stringify(core);
const artifact = { ...core, payloadSha256: createHash('sha256').update(canonical).digest('hex') };
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ scientificGate: artifact.scientificGate, observed: artifact.observed }, null, 2));
