#!/usr/bin/env python3
"""Independent exact audit for the distribution-free branch theorem."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
from fractions import Fraction
from pathlib import Path


def positive_vectors(total, n):
    for cuts in itertools.combinations(range(1, total), n - 1):
        points = (0,) + cuts + (total,)
        yield tuple(points[i + 1] - points[i] for i in range(n))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("result", type=Path)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()
    source = json.loads(args.result.read_text())
    violations = cases = 0
    unique_counts = {}
    for n in range(2, 8):
        priors = set()
        for total in range(n, 17):
            for nums in positive_vectors(total, n):
                priors.add(tuple(Fraction(x, total) for x in nums))
        unique_counts[str(n)] = len(priors)
        subsets = [s for k in range(1, n + 1) for s in itertools.combinations(range(n), k)]
        for p in priors:
            m = max(p)
            for branch in subsets:
                cases += 1
                q = sum(p[i] for i in branch)
                r = max(p[i] for i in branch)
                violations += int(r > Fraction(n - len(branch) + 1) * m * q)

    extremizer_failures = 0
    for n in range(2, 65):
        for k in range(1, n + 1):
            h = Fraction(1, n - k + 1)
            p = (h,) + (Fraction(0),) * (k - 1) + (h,) * (n - k)
            q = sum(p[:k]); r = max(p[:k]); m = max(p)
            extremizer_failures += int(r != Fraction(n - k + 1) * m * q)

    predicted_limit_failures = 0
    maximum_gap = 0.0
    formula_failures = 0
    for n in range(2, 33):
        for k in range(1, n + 1):
            previous = -1.0
            for exponent in (8, 12, 16, 20):
                delta = Fraction(1, 2**exponent)
                exact_gap = math.log2(float(1 + (k - 1) * (n - k) * delta))
                heavy = (Fraction(1) - (k - 1) * delta) / (n - k + 1)
                q = heavy + (k - 1) * delta
                observed_gap = math.log2(n - k + 1) - math.log2(float(1 / q))
                formula_failures += int(abs(exact_gap - observed_gap) > 1e-14)
                formula_failures += int(previous >= 0 and observed_gap > previous + 1e-15)
                previous = observed_gap
            maximum_gap = max(maximum_gap, previous)
            predicted_limit_failures += int(previous >= 1e-4)

    c = source["coverage_counterexample"]
    counterexample_valid = (
        c["same_transcript"] is True
        and c["secret"] in c["branch"]
        and c["uncovered_charge_bits"] > c["declared_charge_bits"]
    )
    checks = {
        "source_digest": hashlib.sha256(args.result.read_bytes()).hexdigest() == "2cc96c8326b0eec58cd4b7cb51a421aab8c85c29aa22cffded2047deecca0ec6",
        "prior_counts": unique_counts == source["prior_counts"],
        "case_count": cases == source["counts"]["prior_branch_cases"],
        "upper_bound": violations == source["counts"]["upper_bound_violations"] == 0,
        "extremizers": extremizer_failures == source["counts"]["extremizer_failures"] == 0,
        "limit_formula": formula_failures == 0,
        "limit_failure_explained": predicted_limit_failures == source["counts"]["positive_limit_failures"] == 237,
        "maximum_gap": abs(maximum_gap - source["maximum_positive_limit_gap_bits"]) < 1e-15,
        "coverage_counterexample": counterexample_valid,
    }
    payload = {
        "schema": "hush.distribution-free-branch-bound-audit.v1",
        "checks": checks, "status": "PASS" if all(checks.values()) else "FAIL",
        "cases": cases, "upper_bound_violations": violations,
        "positive_limit_failures_explained": predicted_limit_failures,
        "exact_limit_gap_law": "log2(1+(k-1)(n-k)delta)",
        "source_canonical_sha256": source["canonical_payload_sha256"],
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["canonical_payload_sha256"] = hashlib.sha256(canonical).hexdigest()
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(json.dumps(payload, sort_keys=True))
    raise SystemExit(0 if payload["status"] == "PASS" else 1)


if __name__ == "__main__":
    main()

