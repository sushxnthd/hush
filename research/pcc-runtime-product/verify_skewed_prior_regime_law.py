#!/usr/bin/env python3
"""Exhaustively verify the preregistered skewed-prior regime law."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections.abc import Iterator
from pathlib import Path


TOLERANCE = 1e-12


def positive_compositions(total: int, parts: int) -> Iterator[tuple[int, ...]]:
    """Yield ordered positive integer compositions in lexicographic order."""
    if parts == 1:
        yield (total,)
        return
    for first in range(1, total - parts + 2):
        for rest in positive_compositions(total - first, parts - 1):
            yield (first, *rest)


def classify_exact(numerator: int, denominator: int) -> str:
    if numerator > denominator:
        return "overcharge"
    if numerator < denominator:
        return "undercharge"
    return "equality"


def classify_numeric(gap: float) -> str:
    if gap > TOLERANCE:
        return "overcharge"
    if gap < -TOLERANCE:
        return "undercharge"
    return "equality"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-domain", type=int, default=7)
    parser.add_argument("--max-denominator", type=int, default=12)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 2 <= args.max_domain <= 12:
        raise SystemExit("max-domain must be in 2..12")
    if not args.max_domain <= args.max_denominator <= 40:
        raise SystemExit("max-denominator must be in max-domain..40")

    cases = 0
    priors = 0
    uniform_cases = 0
    singleton_cases = 0
    decomposition_disagreements = 0
    sign_disagreements = 0
    uniform_disagreements = 0
    singleton_disagreements = 0
    max_abs_error = 0.0
    regime_counts = {"overcharge": 0, "equality": 0, "undercharge": 0}
    first_examples: dict[str, dict[str, object]] = {}
    by_domain = []

    for n in range(2, args.max_domain + 1):
        domain_cases = 0
        domain_priors = 0
        domain_regimes = {"overcharge": 0, "equality": 0, "undercharge": 0}
        for denominator in range(n, args.max_denominator + 1):
            for weights in positive_compositions(denominator, n):
                priors += 1
                domain_priors += 1
                max_weight = max(weights)
                is_uniform = len(set(weights)) == 1
                for branch_mask in range(1, (1 << n) - 1):
                    branch_weights = [
                        weights[index]
                        for index in range(n)
                        if branch_mask & (1 << index)
                    ]
                    k = len(branch_weights)
                    branch_mass_weight = sum(branch_weights)
                    branch_max_weight = max(branch_weights)

                    cardinality = math.log2(n / k)
                    min_entropy = math.log2(
                        (branch_max_weight * denominator)
                        / (max_weight * branch_mass_weight)
                    )
                    observed_gap = cardinality - min_entropy

                    # alpha / beta exactly equals the following rational.
                    ratio_numerator = n * max_weight * branch_mass_weight
                    ratio_denominator = denominator * k * branch_max_weight
                    predicted_gap = math.log2(ratio_numerator / ratio_denominator)
                    error = abs(observed_gap - predicted_gap)
                    max_abs_error = max(max_abs_error, error)
                    if error > TOLERANCE:
                        decomposition_disagreements += 1

                    exact_regime = classify_exact(ratio_numerator, ratio_denominator)
                    numeric_regime = classify_numeric(observed_gap)
                    if exact_regime != numeric_regime:
                        sign_disagreements += 1

                    cases += 1
                    domain_cases += 1
                    regime_counts[exact_regime] += 1
                    domain_regimes[exact_regime] += 1

                    if is_uniform:
                        uniform_cases += 1
                        if exact_regime != "equality":
                            uniform_disagreements += 1

                    if k == 1:
                        singleton_cases += 1
                        corollary = math.log2(n * max_weight / denominator)
                        if abs(observed_gap - corollary) > TOLERANCE:
                            singleton_disagreements += 1

                    if exact_regime not in first_examples:
                        first_examples[exact_regime] = {
                            "domainSize": n,
                            "denominator": denominator,
                            "weights": list(weights),
                            "branchIndices": [
                                index
                                for index in range(n)
                                if branch_mask & (1 << index)
                            ],
                            "cardinalityChargeBits": cardinality,
                            "statewiseMinEntropyReductionBits": min_entropy,
                            "gapBits": observed_gap,
                            "alphaOverBetaNumerator": ratio_numerator,
                            "alphaOverBetaDenominator": ratio_denominator,
                        }

        by_domain.append({
            "domainSize": n,
            "priors": domain_priors,
            "cases": domain_cases,
            "regimes": domain_regimes,
        })

    gates = {
        "decomposition_identity": decomposition_disagreements == 0,
        "exact_sign_prediction": sign_disagreements == 0,
        "uniform_priors_are_equality": uniform_cases > 0 and uniform_disagreements == 0,
        "singleton_corollary": singleton_cases > 0 and singleton_disagreements == 0,
        "all_three_regimes_observed": all(count > 0 for count in regime_counts.values()),
        "nonempty_exhaustive_domain": cases > 0 and priors > 0,
    }
    result = {
        "study": "skewed-prior cardinality/min-entropy regime law",
        "classification": "DISCRIMINATION / SURPRISE",
        "maxDomain": args.max_domain,
        "maxDenominator": args.max_denominator,
        "priors": priors,
        "cases": cases,
        "uniformCases": uniform_cases,
        "singletonCases": singleton_cases,
        "regimeCounts": regime_counts,
        "firstExamples": first_examples,
        "decompositionDisagreements": decomposition_disagreements,
        "signDisagreements": sign_disagreements,
        "uniformDisagreements": uniform_disagreements,
        "singletonDisagreements": singleton_disagreements,
        "maxAbsError": max_abs_error,
        "byDomain": by_domain,
        "gates": gates,
        "gateStatus": "PASS" if all(gates.values()) else "FAIL",
        "law": "C-L=log2(alpha/beta), alpha=n*max(p), beta=k*max_B(p)/P(B)",
        "claimBoundary": "Finite positive rational priors; deterministic set-valued releases; statewise min-entropy reduction versus cardinality charge.",
    }
    canonical = json.dumps(result, sort_keys=True, separators=(",", ":"))
    result["resultSha256"] = hashlib.sha256(canonical.encode()).hexdigest()
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if result["gateStatus"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
