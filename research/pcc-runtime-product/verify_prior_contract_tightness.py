#!/usr/bin/env python3
"""Exact construction showing the three-log prior certificate is tight."""

import argparse
import hashlib
import json
import math
from fractions import Fraction
from pathlib import Path

CREATED_AT = "2026-10-13T00:35:00Z"


def ceil_fraction(x):
    return (x.numerator + x.denominator - 1) // x.denominator


def split_bounded(total, cap):
    if total == 0:
        return []
    count = ceil_fraction(total / cap)
    return [total / count] * count


def construct(R, N):
    R = Fraction(R)
    low_total = R / (R + 1)
    high_total = 1 / (R + 1)
    M = 1 / (2 * (R + 1))
    x = M / (2 * R * R * N)
    low_branch = [x] * N
    high_branch = [x]
    low_rest = split_bounded(low_total - N * x - M, M)
    high_rest = split_bounded(high_total - x, M / (R * R))
    h = low_branch + high_branch + [M] + low_rest + high_rest
    classes = ["low"] * N + ["high"] + ["low"] + ["low"] * len(low_rest) + ["high"] * len(high_rest)
    p = [v / R if c == "low" else v * R for v, c in zip(h, classes)]
    branch = tuple(range(N + 1))
    return p, h, branch, classes, M, x


def charge(v, branch):
    q = sum(v[i] for i in branch)
    r = max(v[i] for i in branch)
    m = max(v)
    ratio = r / (m * q)
    return ratio, math.log2(float(ratio)), (m, q, r)


def frac(x):
    return f"{x.numerator}/{x.denominator}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    cases = []
    violations = {"normalization": 0, "rho": 0, "extrema": 0, "closed_form": 0, "threshold": 0, "three_log": 0, "monotonic": 0}
    witness = None
    for R in range(2, 11):
        previous = -math.inf
        for N in (R + 1, 2 * R, 10 * R, 100 * R, 1000 * R):
            p, h, branch, classes, M, x = construct(R, N)
            violations["normalization"] += int(sum(p) != 1 or sum(h) != 1 or min(p) <= 0 or min(h) <= 0)
            ratios = [a / b for a, b in zip(p, h)]
            rho = max(max(z, 1 / z) for z in ratios)
            violations["rho"] += int(rho != R)
            hp_ratio, lh, (mh, qh, rh) = charge(h, branch)
            pp_ratio, lp, (mp, qp, rp) = charge(p, branch)
            violations["extrema"] += int(mh != M or mp != M / R or rh != x or rp != R * x)
            exact_gap_ratio = pp_ratio / hp_ratio
            closed = Fraction(R**3 * (N + 1), N + R**2)
            violations["closed_form"] += int(exact_gap_ratio != closed)
            gamma = math.log(float(exact_gap_ratio), R)
            violations["threshold"] += int((gamma > 2) != (N > R))
            violations["three_log"] += int(gamma >= 3 or lp - lh > 3 * math.log2(R) + 1e-12)
            violations["monotonic"] += int(gamma <= previous)
            previous = gamma
            case = {"R": R, "N": N, "dimension": len(p), "gap_ratio": frac(exact_gap_ratio), "gap_bits": lp - lh, "gamma": gamma}
            cases.append(case)
            if R == 2 and N == 3:
                witness = {
                    **case,
                    "declared_charge_bits": lh,
                    "true_charge_bits": lp,
                    "two_log_bound_bits": 2 * math.log2(R),
                    "three_log_bound_bits": 3 * math.log2(R),
                    "M": frac(M),
                    "x": frac(x),
                    "declared_prior": [frac(v) for v in h],
                    "true_prior": [frac(v) for v in p],
                    "branch": list(branch),
                }
    gates = {k: v == 0 for k, v in violations.items()}
    payload = {
        "schema": "hush.prior-contract-tightness.v1",
        "created_at_utc": CREATED_AT,
        "construction": {"R": [2, 10], "N_multipliers": ["R+1", 2, 10, 100, 1000]},
        "case_count": len(cases),
        "violations": violations,
        "gates": gates,
        "smallest_witness": witness,
        "cases": cases,
        "status": "PASS" if all(gates.values()) else "FAIL",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["canonical_payload_sha256"] = hashlib.sha256(canonical).hexdigest()
    data = (json.dumps(payload, sort_keys=True, indent=2) + "\n").encode()
    Path(args.output).write_bytes(data)
    print(json.dumps({"status": payload["status"], "sha256": hashlib.sha256(data).hexdigest(), "canonical": payload["canonical_payload_sha256"], "witness_gamma": witness["gamma"], "largest_gamma": max(x["gamma"] for x in cases)}, sort_keys=True))


if __name__ == "__main__":
    main()
