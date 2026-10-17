#!/usr/bin/env python3
"""Frozen exact verifier for the distribution-free branch bound."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import platform
from fractions import Fraction
from pathlib import Path


def compositions(total, length, prefix=()):
    if length == 1:
        yield prefix + (total,)
        return
    for first in range(1, total - length + 2):
        yield from compositions(total - first, length - 1, prefix + (first,))


def charge(prior, branch):
    m = max(prior)
    q = sum(prior[i] for i in branch)
    r = max(prior[i] for i in branch)
    ratio = r / (m * q)
    return max(0.0, math.log2(float(ratio))), ratio


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-domain", type=int, default=7)
    ap.add_argument("--max-denominator", type=int, default=16)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    counts = {
        "unique_priors": 0,
        "prior_branch_cases": 0,
        "upper_bound_violations": 0,
        "extremizer_checks": 0,
        "extremizer_failures": 0,
        "positive_limit_checks": 0,
        "positive_limit_failures": 0,
        "cardinality_order_checks": 0,
        "cardinality_order_failures": 0,
    }
    worst_gap = {"bits": -1.0}
    prior_counts = {}
    for n in range(2, args.max_domain + 1):
        ps = set()
        for total in range(n, args.max_denominator + 1):
            for nums in compositions(total, n):
                ps.add(tuple(Fraction(x, total) for x in nums))
        prior_counts[str(n)] = len(ps)
        counts["unique_priors"] += len(ps)
        branches = [tuple(i for i in range(n) if mask & (1 << i)) for mask in range(1, 1 << n)]
        for p in sorted(ps):
            for branch in branches:
                counts["prior_branch_cases"] += 1
                value, ratio = charge(p, branch)
                bound_ratio = Fraction(n - len(branch) + 1, 1)
                if ratio > bound_ratio:
                    counts["upper_bound_violations"] += 1
                gap = math.log2(float(bound_ratio)) - value
                if gap > worst_gap["bits"]:
                    worst_gap = {"bits": gap, "n": n, "k": len(branch), "prior": [str(x) for x in p], "branch": list(branch)}

    for n in range(2, 65):
        for k in range(1, n + 1):
            counts["extremizer_checks"] += 1
            branch = tuple(range(k))
            heavy = Fraction(1, n - k + 1)
            p = [Fraction(0) for _ in range(n)]
            p[0] = heavy
            for i in range(k, n):
                p[i] = heavy
            _, ratio = charge(tuple(p), branch)
            if ratio != n - k + 1:
                counts["extremizer_failures"] += 1

    final_limit_gap = 0.0
    for n in range(2, 33):
        for k in range(1, n + 1):
            branch = tuple(range(k))
            target = math.log2(n - k + 1)
            values = []
            for exponent in (8, 12, 16, 20):
                delta = Fraction(1, 2**exponent)
                heavy = (Fraction(1) - (k - 1) * delta) / (n - k + 1)
                p = [delta for _ in range(n)]
                p[0] = heavy
                for i in range(k, n):
                    p[i] = heavy
                value, _ = charge(tuple(p), branch)
                values.append(value)
                counts["positive_limit_checks"] += 1
            gap = target - values[-1]
            final_limit_gap = max(final_limit_gap, gap)
            if any(a > b + 1e-15 for a, b in zip(values, values[1:])) or gap >= 1e-4:
                counts["positive_limit_failures"] += 1

    equality_failures = 0
    for n in range(2, 65):
        for k in range(1, n + 1):
            counts["cardinality_order_checks"] += 1
            lhs = Fraction(n - k + 1, 1)
            rhs = Fraction(n, k)
            if lhs < rhs or ((lhs == rhs) != (k == 1 or k == n)):
                equality_failures += 1
    counts["cardinality_order_failures"] = equality_failures

    # Same deterministic transcript: secret state 0 lies in B={0,1} under both
    # priors. The declared singleton ensemble understates the uncovered prior.
    branch = (0, 1)
    declared = (Fraction(1, 3), Fraction(1, 3), Fraction(1, 3))
    uncovered = (Fraction(1, 2), Fraction(0), Fraction(1, 2))
    declared_charge, _ = charge(declared, branch)
    uncovered_charge, _ = charge(uncovered, branch)
    counterexample = {
        "n": 3, "secret": 0, "branch": list(branch),
        "declared_prior": [str(x) for x in declared],
        "uncovered_prior": [str(x) for x in uncovered],
        "declared_charge_bits": declared_charge,
        "uncovered_charge_bits": uncovered_charge,
        "same_transcript": True,
    }
    gates = {
        "exact_upper_bound": counts["upper_bound_violations"] == 0,
        "zero_mass_extremizers": counts["extremizer_failures"] == 0,
        "positive_limit": counts["positive_limit_failures"] == 0,
        "coverage_counterexample": counterexample["same_transcript"] and uncovered_charge > declared_charge,
        "dominates_cardinality": counts["cardinality_order_failures"] == 0,
    }
    payload = {
        "schema": "hush.distribution-free-branch-bound.v1",
        "environment": {"python": platform.python_version()},
        "grid": {"domain": [2, args.max_domain], "denominator": ["n", args.max_denominator]},
        "prior_counts": prior_counts, "counts": counts,
        "maximum_positive_limit_gap_bits": final_limit_gap,
        "largest_observed_bound_slack": worst_gap,
        "coverage_counterexample": counterexample,
        "gates": gates, "status": "PASS" if all(gates.values()) else "FAIL",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["canonical_payload_sha256"] = hashlib.sha256(canonical).hexdigest()
    rendered = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode()
    Path(args.output).write_bytes(rendered)
    print(json.dumps({"status": payload["status"], "sha256": hashlib.sha256(rendered).hexdigest(), "canonical": payload["canonical_payload_sha256"], "counts": counts, "counterexample": counterexample}, sort_keys=True))


if __name__ == "__main__":
    main()
