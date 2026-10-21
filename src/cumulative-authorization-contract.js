function stable(value) {
  return JSON.stringify(value);
}

function pairs(items) {
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) out.push([items[i], items[j]]);
  }
  return out;
}

function validateMap(worlds, map, label) {
  if (!map || typeof map !== 'object') throw new Error(`${label} must be a map`);
  for (const world of worlds) {
    if (!(world in map)) throw new Error(`${label} missing world ${world}`);
  }
}

function same(map, left, right) {
  return stable(map[left]) === stable(map[right]);
}

/** Return the first pair kept equal by `coarse` but split by `fine`. */
export function firstFiberSplit(worlds, coarse, fine) {
  for (const [left, right] of pairs(worlds)) {
    if (same(coarse, left, right) && !same(fine, left, right)) return { left, right };
  }
  return null;
}

/**
 * Certify a sequence of locally approved calls against one transaction-wide
 * authorization scope. The universal check is prospective: it rejects a local
 * approval capable of releasing a globally forbidden distinction even when the
 * concrete observation happens to be constant. The actual check audits what was
 * released and reports the earliest violating prefix.
 */
export function certifyCumulativeAuthorization({ worlds, globalAuthorization, calls }) {
  if (!Array.isArray(worlds) || worlds.length < 2) throw new Error('worlds must contain at least two ids');
  if (!Array.isArray(calls) || calls.length < 1) throw new Error('at least one call is required');
  if (new Set(worlds).size !== worlds.length) throw new Error('world ids must be unique');
  validateMap(worlds, globalAuthorization, 'globalAuthorization');

  const globalPairs = pairs(worlds).filter(([left, right]) => same(globalAuthorization, left, right));
  const cumulative = Object.fromEntries(worlds.map((world) => [world, []]));
  let firstUniversalViolation = null;
  let firstActualViolation = null;

  for (let index = 0; index < calls.length; index += 1) {
    const call = calls[index];
    const id = call?.id ?? `call-${index + 1}`;
    validateMap(worlds, call?.localAuthorization, `${id}.localAuthorization`);
    validateMap(worlds, call?.observation, `${id}.observation`);

    const localSplit = firstFiberSplit(worlds, call.localAuthorization, call.observation);
    if (localSplit) {
      return {
        safe: false,
        locallySafe: false,
        universallyComposable: false,
        actualSafe: false,
        reason: 'LOCAL_AUTHORIZATION_VIOLATION',
        witness: { ...localSplit, call: id, prefix: index + 1 },
      };
    }

    if (!firstUniversalViolation) {
      for (const [left, right] of globalPairs) {
        if (!same(call.localAuthorization, left, right)) {
          firstUniversalViolation = { left, right, call: id, prefix: index + 1 };
          break;
        }
      }
    }

    for (const world of worlds) cumulative[world].push(call.observation[world]);
    if (!firstActualViolation) {
      const split = firstFiberSplit(worlds, globalAuthorization, cumulative);
      if (split) firstActualViolation = { ...split, call: id, prefix: index + 1 };
    }
  }

  const universallyComposable = firstUniversalViolation === null;
  const actualSafe = firstActualViolation === null;
  return {
    safe: universallyComposable && actualSafe,
    locallySafe: true,
    universallyComposable,
    actualSafe,
    reason: !universallyComposable
      ? 'GLOBAL_SCOPE_REFINEMENT'
      : (!actualSafe ? 'CUMULATIVE_OBSERVATION_VIOLATION' : 'CERTIFIED'),
    witness: firstUniversalViolation ?? firstActualViolation,
    actualWitness: firstActualViolation,
  };
}
