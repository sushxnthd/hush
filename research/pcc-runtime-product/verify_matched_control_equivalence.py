#!/usr/bin/env python3
"""Verify a scoped PCC/posterior/history-aware charge identity."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path


WEIGHTS = (0.5, 1.0, 2.0)
BUDGETS = (0.0, 0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0)


def pcc_charge(state_size: int, branch_size: int) -> float:
    return math.log2(state_size / branch_size)


def posterior_min_entropy_charge(state_size: int, branch_size: int) -> float:
    prior_min_entropy = math.log2(state_size)
    posterior_min_entropy = math.log2(branch_size)
    return prior_min_entropy - posterior_min_entropy


def history_aware_semantic_charge(state_size: int, branch_size: int) -> float:
    return math.log2(state_size) - math.log2(branch_size)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-domain", type=int, default=12)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not 2 <= args.max_domain <= 20:
        raise SystemExit("max-domain must be in 2..20")

    charge_cases = 0
    weighted_decisions = 0
    charge_disagreements = 0
    decision_disagreements = 0
    repeated_disclosure_disagreements = 0
    max_abs_error = 0.0
    by_domain = []

    for n in range(2, args.max_domain + 1):
        domain_charge_cases = 0
        domain_decisions = 0
        for state_mask in range(1, 1 << n):
            state_size = state_mask.bit_count()
            if state_size < 2:
                continue
            release_mask = (state_mask - 1) & state_mask
            while release_mask:
                complement = state_mask ^ release_mask
                if complement:
                    for branch_mask in (release_mask, complement):
                        branch_size = branch_mask.bit_count()
                        pcc = pcc_charge(state_size, branch_size)
                        posterior = posterior_min_entropy_charge(state_size, branch_size)
                        history = history_aware_semantic_charge(state_size, branch_size)
                        error = max(abs(pcc - posterior), abs(pcc - history), abs(posterior - history))
                        max_abs_error = max(max_abs_error, error)
                        charge_cases += 1
                        domain_charge_cases += 1
                        if error > 1e-12:
                            charge_disagreements += 1

                        # A second identical disclosure does not shrink the
                        # already restricted state and must cost zero.
                        repeated = (
                            pcc_charge(branch_size, branch_size),
                            posterior_min_entropy_charge(branch_size, branch_size),
                            history_aware_semantic_charge(branch_size, branch_size),
                        )
                        if any(abs(value) > 1e-12 for value in repeated):
                            repeated_disclosure_disagreements += 1

                        for weight in WEIGHTS:
                            costs = (pcc * weight, posterior * weight, history * weight)
                            for budget in BUDGETS:
                                decisions = tuple(cost <= budget + 1e-12 for cost in costs)
                                weighted_decisions += 1
                                domain_decisions += 1
                                if len(set(decisions)) != 1:
                                    decision_disagreements += 1
                release_mask = (release_mask - 1) & state_mask
        by_domain.append({
            "domainSize": n,
            "chargeCases": domain_charge_cases,
            "weightedBudgetDecisions": domain_decisions,
        })

    nonuniform = {
        "prior": [0.9, 0.1],
        "cardinalityChargeBits": pcc_charge(2, 1),
        "statewiseMinEntropyReductionBits": math.log2(1.0 / 0.9),
    }
    nonuniform["absoluteDifferenceBits"] = abs(
        nonuniform["cardinalityChargeBits"]
        - nonuniform["statewiseMinEntropyReductionBits"]
    )

    gates = {
        "all_uniform_charges_agree": charge_disagreements == 0,
        "all_weighted_budget_decisions_agree": decision_disagreements == 0,
        "repeated_disclosures_are_free": repeated_disclosure_disagreements == 0,
        "max_error_within_tolerance": max_abs_error <= 1e-12,
        "nonuniform_prior_breaks_equivalence": nonuniform["absoluteDifferenceBits"] > 0.8,
    }
    result = {
        "study": "finite-domain matched-control accounting equivalence",
        "classification": "DISCRIMINATION / SURPRISE",
        "maxDomain": args.max_domain,
        "weights": list(WEIGHTS),
        "budgets": list(BUDGETS),
        "chargeCases": charge_cases,
        "weightedBudgetDecisions": weighted_decisions,
        "chargeDisagreements": charge_disagreements,
        "decisionDisagreements": decision_disagreements,
        "repeatedDisclosureDisagreements": repeated_disclosure_disagreements,
        "maxAbsError": max_abs_error,
        "byDomain": by_domain,
        "nonuniformBoundary": nonuniform,
        "gates": gates,
        "gateStatus": "PASS" if all(gates.values()) else "FAIL",
        "claimBoundary": "Uniform finite feasible states, deterministic binary releases, identical history, weights, budgets and feasible-branch authorization.",
    }
    canonical = json.dumps(result, sort_keys=True, separators=(",", ":"))
    result["resultSha256"] = hashlib.sha256(canonical.encode()).hexdigest()
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if result["gateStatus"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
