#!/usr/bin/env python3
import hashlib
import json
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'research/pcc-runtime-product/scheduler_fiber_composition_result.json'
with open(path, encoding='utf-8') as handle:
    artifact = json.load(handle)

# Independent counting argument: four binary component functions per component;
# sixteen schedules; four schedules are constant on both two-world fibers.
expected = {
    'systems': 4 * 4 * 16,
    'finalMultisetSafe': 4 * 4 * 16,
    'orderedPrefixSafe': 4 * 4 * 4,
    'schedulerFiberSafe': 4 * 4 * 4,
    'leaks': 4 * 4 * 12,
    'criterionDisagreements': 0,
}
checks = {
    'protocol': artifact['protocol'] == 'scheduler-fiber-composition-v1',
    'independent_counts': artifact['observed'] == expected,
    'prediction_match': all(artifact['prediction'][key] == expected[key]
                            for key in artifact['prediction']),
    'survival_gate': artifact['scientificGate'] == 'SURVIVE_SCHEDULER_FIBER_LAW',
    'witness_first_prefix': artifact['firstLeak']['witness']['prefix'] == 1,
    'witness_distinct': artifact['firstLeak']['leftTrace'] != artifact['firstLeak']['rightTrace'],
    'final_auditor_misses': artifact['firstLeak']['finalCanonicalEqual'] is True,
}
unsigned = dict(artifact)
digest = unsigned.pop('payloadSha256')
canonical = json.dumps(unsigned, separators=(',', ':'), ensure_ascii=False)
checks['payload_hash'] = hashlib.sha256(canonical.encode()).hexdigest() == digest
for name, passed in checks.items():
    print(('PASS' if passed else 'FAIL'), name)
if not all(checks.values()):
    raise SystemExit(1)
print(f"{sum(checks.values())}/{len(checks)}")
