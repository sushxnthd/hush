#!/usr/bin/env python3
"""Frozen exhaustive verifier for the Hush multiplicative prior contract."""

import argparse
import hashlib
import itertools
import json
import math
import platform
from fractions import Fraction
from pathlib import Path

BUDGETS = (0.0, 0.25, 0.5, 1.0, 2.0, 4.0)
EPS = 1e-12
CREATED_AT = "2026-10-12T23:20:00Z"


def compositions(total, length, prefix=()):
    if length == 1:
        yield prefix + (total,)
        return
    for first in range(1, total - length + 2):
        yield from compositions(total - first, length - 1, prefix + (first,))


def priors(n, max_denominator):
    values = set()
    for denominator in range(n, max_denominator + 1):
        for numerators in compositions(denominator, n):
            values.add(tuple(Fraction(x, denominator) for x in numerators))
    return sorted(values)


def leakage(prior, indices):
    branch_mass = sum(prior[i] for i in indices)
    return math.log2(float(max(prior[i] for i in indices) / (max(prior) * branch_mass)))


def rho_between(p, h):
    return float(max(max(a / b, b / a) for a, b in zip(p, h)))


def prior_text(prior):
    return [f"{x.numerator}/{x.denominator}" for x in prior]


def example_key(item):
    if item is None:
        return (10**9,)
    return (item["n"], item["declared"], item["true"], item["branch"], item["budget"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-domain", type=int, default=5)
    parser.add_argument("--max-denominator", type=int, default=10)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    counts = {
        "prior_pairs": 0,
        "prior_pair_branches": 0,
        "theorem_violations": 0,
        "robust_upper_bound_violations": 0,
        "rho_one_disagreements": 0,
        "two_log_counterexamples": 0,
    }
    decisions = {
        name: {str(b): {"false_safe": 0, "false_deny": 0} for b in BUDGETS}
        for name in ("cardinality", "nominal", "robust")
    }
    max_bound_error = 0.0
    max_robust_shortfall = 0.0
    max_gamma = {"value": -1.0}
    minimal_false_safe = {"cardinality": None, "nominal": None}
    prior_counts = {}

    for n in range(2, args.max_domain + 1):
        ps = priors(n, args.max_denominator)
        prior_counts[str(n)] = len(ps)
        branches = [tuple(i for i in range(n) if mask & (1 << i)) for mask in range(1, (1 << n) - 1)]
        for p in ps:
            for h in ps:
                counts["prior_pairs"] += 1
                rho = rho_between(p, h)
                allowance = 3.0 * math.log2(rho)
                two_allowance = 2.0 * math.log2(rho)
                for branch in branches:
                    counts["prior_pair_branches"] += 1
                    lp = leakage(p, branch)
                    lh = leakage(h, branch)
                    delta = abs(lp - lh)
                    bound_error = delta - allowance
                    max_bound_error = max(max_bound_error, bound_error)
                    if bound_error > EPS:
                        counts["theorem_violations"] += 1
                    true_charge = max(0.0, lp)
                    nominal = max(0.0, lh)
                    robust = max(0.0, lh + allowance)
                    cardinality = math.log2(n / len(branch))
                    shortfall = true_charge - robust
                    max_robust_shortfall = max(max_robust_shortfall, shortfall)
                    if shortfall > EPS:
                        counts["robust_upper_bound_violations"] += 1
                    if abs(rho - 1.0) <= EPS and delta > EPS:
                        counts["rho_one_disagreements"] += 1
                    if rho > 1.0 + EPS:
                        gamma = delta / math.log2(rho)
                        candidate = {
                            "value": gamma,
                            "n": n,
                            "true": prior_text(p),
                            "declared": prior_text(h),
                            "branch": list(branch),
                            "rho": rho,
                            "true_leakage": lp,
                            "declared_leakage": lh,
                        }
                        if gamma > max_gamma["value"]:
                            max_gamma = candidate
                        if delta > two_allowance + EPS:
                            counts["two_log_counterexamples"] += 1
                    charges = {"cardinality": cardinality, "nominal": nominal, "robust": robust}
                    for budget in BUDGETS:
                        key = str(budget)
                        for name, charge in charges.items():
                            false_safe = charge <= budget + EPS and true_charge > budget + EPS
                            false_deny = charge > budget + EPS and true_charge <= budget + EPS
                            decisions[name][key]["false_safe"] += int(false_safe)
                            decisions[name][key]["false_deny"] += int(false_deny)
                            if false_safe and name in minimal_false_safe:
                                ex = {
                                    "n": n,
                                    "true": prior_text(p),
                                    "declared": prior_text(h),
                                    "branch": list(branch),
                                    "budget": budget,
                                    "true_charge": true_charge,
                                    "policy_charge": charge,
                                    "rho": rho,
                                }
                                if example_key(ex) < example_key(minimal_false_safe[name]):
                                    minimal_false_safe[name] = ex

    gates = {
        "theorem_bound": counts["theorem_violations"] == 0,
        "robust_upper_bound": counts["robust_upper_bound_violations"] == 0,
        "robust_zero_false_safe": all(v["false_safe"] == 0 for v in decisions["robust"].values()),
        "rho_one_exact": counts["rho_one_disagreements"] == 0,
    }
    payload = {
        "schema": "hush.prior-contract-certificate.v1",
        "created_at_utc": CREATED_AT,
        "python": platform.python_version(),
        "command": "python3 verify_prior_contract_certificate.py --max-domain 5 --max-denominator 10 --output RESULT.json",
        "grid": {"domain": [2, args.max_domain], "denominator": ["n", args.max_denominator], "budgets_bits": list(BUDGETS)},
        "prior_counts": prior_counts,
        "counts": counts,
        "decisions": decisions,
        "max_bound_error": max_bound_error,
        "max_robust_shortfall": max_robust_shortfall,
        "max_normalized_mismatch": max_gamma,
        "minimal_false_safe": minimal_false_safe,
        "gates": gates,
        "status": "PASS" if all(gates.values()) else "FAIL",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    payload["canonical_payload_sha256"] = hashlib.sha256(canonical).hexdigest()
    rendered = (json.dumps(payload, sort_keys=True, indent=2) + "\n").encode()
    Path(args.output).write_bytes(rendered)
    print(json.dumps({"status": payload["status"], "sha256": hashlib.sha256(rendered).hexdigest(), "canonical": payload["canonical_payload_sha256"], "counts": counts, "max_gamma": max_gamma["value"]}, sort_keys=True))


if __name__ == "__main__":
    main()
