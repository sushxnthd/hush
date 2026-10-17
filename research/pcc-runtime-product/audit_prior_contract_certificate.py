#!/usr/bin/env python3
"""Independent aggregate audit using integer compositions and direct formulas."""

import argparse
import hashlib
import itertools
import json
import math
from fractions import Fraction


def parts(total, slots):
    for cuts in itertools.combinations(range(1, total), slots - 1):
        points = (0,) + cuts + (total,)
        yield tuple(points[i + 1] - points[i] for i in range(slots))


def all_priors(n, cap):
    return sorted({tuple(Fraction(v, d) for v in row) for d in range(n, cap + 1) for row in parts(d, n)})


def ell(x, mask):
    selected = [x[i] for i in range(len(x)) if mask >> i & 1]
    return math.log2(float(max(selected) / (max(x) * sum(selected))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("result")
    args = ap.parse_args()
    doc = json.load(open(args.result, encoding="utf-8"))
    nmax = doc["grid"]["domain"][1]
    dmax = doc["grid"]["denominator"][1]
    totals = {"prior_pairs": 0, "prior_pair_branches": 0, "theorem_violations": 0, "robust_upper_bound_violations": 0, "rho_one_disagreements": 0, "two_log_counterexamples": 0}
    robust_false_safe = {str(b): 0 for b in doc["grid"]["budgets_bits"]}
    for n in range(2, nmax + 1):
        priors = all_priors(n, dmax)
        for p, h in itertools.product(priors, repeat=2):
            totals["prior_pairs"] += 1
            rho = max(float(max(a / b, b / a)) for a, b in zip(p, h))
            log_rho = math.log2(rho)
            for mask in range(1, (1 << n) - 1):
                totals["prior_pair_branches"] += 1
                a, b = ell(p, mask), ell(h, mask)
                totals["theorem_violations"] += int(abs(a - b) > 3 * log_rho + 1e-12)
                t, r = max(0.0, a), max(0.0, b + 3 * log_rho)
                totals["robust_upper_bound_violations"] += int(t > r + 1e-12)
                totals["rho_one_disagreements"] += int(abs(rho - 1) <= 1e-12 and abs(a - b) > 1e-12)
                totals["two_log_counterexamples"] += int(rho > 1 + 1e-12 and abs(a - b) > 2 * log_rho + 1e-12)
                for budget in doc["grid"]["budgets_bits"]:
                    robust_false_safe[str(budget)] += int(r <= budget + 1e-12 and t > budget + 1e-12)
    expected = {k: doc["counts"][k] for k in totals}
    check = {
        "totals_match": totals == expected,
        "robust_false_safe_match": robust_false_safe == {k: v["false_safe"] for k, v in doc["decisions"]["robust"].items()},
        "source_result_canonical_sha256": doc["canonical_payload_sha256"],
        "recomputed_aggregate_sha256": hashlib.sha256(json.dumps({"totals": totals, "robust_false_safe": robust_false_safe}, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
    }
    check["status"] = "PASS" if check["totals_match"] and check["robust_false_safe_match"] else "FAIL"
    print(json.dumps(check, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
