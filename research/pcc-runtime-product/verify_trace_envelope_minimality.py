#!/usr/bin/env python3
"""Exhaust the trace-envelope minimality and decision-difference laws."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
from pathlib import Path

VALUES = (0, 1, 2, 3)
BUDGETS = tuple(value / 2 for value in range(8))


def charges(matrix):
    members = len(matrix[0])
    previous = [0] * members
    envelope = independent = 0
    aseq, qseq = [], []
    for row in matrix:
        envelope = max(envelope, max(row))
        independent += max(max(0, row[p] - previous[p]) for p in range(members))
        previous = list(row)
        aseq.append(envelope)
        qseq.append(independent)
    return aseq, qseq


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()

    matrices = prefixes = safe_ledgers = decision_checks = 0
    failures = []
    by_shape = {}
    ledger_candidates = {
        steps: tuple(itertools.combinations_with_replacement(range(5), steps))
        for steps in range(1, 4)
    }
    for members in range(1, 4):
        for steps in range(1, 4):
            shape_matrices = shape_checks = 0
            for flat in itertools.product(VALUES, repeat=members * steps):
                matrix = tuple(
                    tuple(flat[step * members:(step + 1) * members])
                    for step in range(steps)
                )
                matrices += 1
                shape_matrices += 1
                aseq, qseq = charges(matrix)
                oracle = [max(row[p] for row in matrix) for p in range(members)]
                for end in range(steps):
                    prefixes += 1
                    A, Q = aseq[end], qseq[end]
                    if A > Q:
                        failures.append({'kind': 'dominance', 'matrix': matrix, 'prefix': end, 'A': A, 'Q': Q})
                    for ledger in ledger_candidates[end + 1]:
                        safe = all(
                            ledger[j] >= max(matrix[s][p] for s in range(j + 1) for p in range(members))
                            for j in range(end + 1)
                        )
                        if not safe:
                            continue
                        safe_ledgers += 1
                        if any(ledger[j] < aseq[j] for j in range(end + 1)):
                            failures.append({'kind': 'minimality', 'matrix': matrix, 'ledger': ledger})
                    for p in range(members):
                        O = max(matrix[s][p] for s in range(end + 1))
                        for budget in BUDGETS:
                            fd_a = int(A > budget and O <= budget)
                            fd_q = int(Q > budget and O <= budget)
                            predicted = int(A <= budget < Q)
                            decision_checks += 1
                            shape_checks += 1
                            if fd_q - fd_a != predicted:
                                failures.append({
                                    'kind': 'decision_identity', 'matrix': matrix, 'prefix': end,
                                    'member': p, 'budget': budget, 'A': A, 'Q': Q, 'O': O,
                                })
                    if len(failures) >= 20:
                        break
                if len(failures) >= 20:
                    break
            by_shape[f'{members}x{steps}'] = {
                'matrices': shape_matrices,
                'decision_identity_checks': shape_checks,
            }
            if failures:
                break
        if failures:
            break

    gates = {
        'no_counterexamples': not failures,
        'all_shapes_exhausted': len(by_shape) == 9,
        'nonempty_safe_ledger_comparison': safe_ledgers > 0,
        'nonempty_decision_identity_check': decision_checks > 0,
    }
    payload = {
        'schema': 'hush.trace-envelope-minimality.v1',
        'classification': 'EXACT_ENUMERATION',
        'risk_values': VALUES,
        'budgets': BUDGETS,
        'matrices': matrices,
        'prefixes': prefixes,
        'safe_monotone_ledgers_checked': safe_ledgers,
        'decision_identity_checks': decision_checks,
        'by_shape': by_shape,
        'counterexamples': failures,
        'gates': gates,
        'status': 'PASS' if all(gates.values()) else 'FAIL',
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode()
    payload['canonical_payload_sha256'] = hashlib.sha256(canonical).hexdigest()
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + '\n')
    print(json.dumps({key: payload[key] for key in (
        'status', 'matrices', 'prefixes', 'safe_monotone_ledgers_checked',
        'decision_identity_checks', 'gates', 'canonical_payload_sha256')}, indent=2))


if __name__ == '__main__':
    main()
