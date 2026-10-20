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

/**
 * Fail-closed finite certificate for one-event-per-component concurrent plans.
 * Component tags are observable and schedules must contain every component once.
 */
export function certifySchedulerFiberComposition({ worlds, authorization, componentEvents, schedules }) {
  if (!Array.isArray(worlds) || worlds.length < 2) throw new Error('worlds must contain at least two ids');
  const components = Object.keys(componentEvents ?? {}).sort();
  if (components.length < 2) throw new Error('at least two components are required');
  const expected = stable(components);

  for (const world of worlds) {
    if (!(world in authorization) || !(world in schedules)) throw new Error(`missing world ${world}`);
    if (stable([...schedules[world]].sort()) !== expected) throw new Error(`invalid schedule for ${world}`);
    for (const component of components) {
      if (!(world in componentEvents[component])) throw new Error(`missing ${component} event for ${world}`);
    }
  }

  const sameFiberPairs = pairs(worlds).filter(([left, right]) =>
    stable(authorization[left]) === stable(authorization[right]));

  for (const [left, right] of sameFiberPairs) {
    for (const component of components) {
      if (stable(componentEvents[component][left]) !== stable(componentEvents[component][right])) {
        return {
          safe: false,
          componentSafe: false,
          schedulerSafe: false,
          reason: 'COMPONENT_FIBER_VIOLATION',
          witness: { left, right, component, prefix: 1 },
        };
      }
    }
  }

  for (const [left, right] of sameFiberPairs) {
    for (let step = 0; step < components.length; step += 1) {
      if (schedules[left][step] !== schedules[right][step]) {
        return {
          safe: false,
          componentSafe: true,
          schedulerSafe: false,
          reason: 'SCHEDULER_FIBER_VIOLATION',
          witness: {
            left,
            right,
            prefix: step + 1,
            leftComponent: schedules[left][step],
            rightComponent: schedules[right][step],
          },
        };
      }
    }
  }

  return { safe: true, componentSafe: true, schedulerSafe: true, reason: 'CERTIFIED', witness: null };
}

export function taggedTrace(world, componentEvents, schedule) {
  return schedule.map((component) => ({ component, event: componentEvents[component][world] }));
}

export function canonicalFinalMultiset(world, componentEvents, schedule) {
  return taggedTrace(world, componentEvents, schedule)
    .map((entry) => stable(entry))
    .sort();
}
