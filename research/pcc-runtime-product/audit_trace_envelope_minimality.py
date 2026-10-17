#!/usr/bin/env python3
"""Independent constructive audit of the trace-envelope laws."""
from __future__ import annotations

import argparse
import hashlib
import json
import random


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('result')
    args = parser.parse_args()
    source = json.load(open(args.result))
    rng = random.Random(20261014)
    cases = checks = 0
    failures = []
    for members in range(1, 13):
        for steps in range(1, 17):
            for _ in range(40):
                rows = [[rng.randrange(0, 65) / 8 for _ in range(members)] for _ in range(steps)]
                previous = [0.0] * members
                A = Q = 0.0
                oracles = [0.0] * members
                for row in rows:
                    A = max(A, max(row))
                    Q += max(max(0.0, row[p] - previous[p]) for p in range(members))
                    previous = row
                    oracles = [max(oracles[p], row[p]) for p in range(members)]
                    checks += 1
                    if A > Q + 1e-12 or any(oracle > A + 1e-12 for oracle in oracles):
                        failures.append((members, steps, 'safety'))
                    for budget in (0, .5, 1, 2, 4, 8, 16):
                        for oracle in oracles:
                            left = int(Q > budget and oracle <= budget) - int(A > budget and oracle <= budget)
                            right = int(A <= budget < Q)
                            checks += 1
                            if left != right:
                                failures.append((members, steps, 'identity'))
                cases += 1
    digest = hashlib.sha256(json.dumps([cases, checks, failures], separators=(',', ':')).encode()).hexdigest()
    result = {
        'schema': 'hush.trace-envelope-minimality-independent-audit.v1',
        'source_canonical_sha256': source['canonical_payload_sha256'],
        'seed': 20261014,
        'cases': cases,
        'checks': checks,
        'failures': failures[:20],
        'audit_digest': digest,
        'status': 'PASS' if not failures and source['status'] == 'PASS' else 'FAIL',
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    raise SystemExit(0 if result['status'] == 'PASS' else 1)


if __name__ == '__main__':
    main()
