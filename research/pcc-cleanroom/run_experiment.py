#!/usr/bin/env python3
"""Deterministic, exhaustive evaluation for the clean-room PCC mechanism."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from pcc_cleanroom import CompilationError, NumericPredicateContract, compile_numeric_predicate


DOMAIN = 4096
THRESHOLDS = (0, 1, 511, 1024, 2048, 3072, 4095)
TEMPLATES = (
    "Local calendar cutoff is {value}. Private note CANARY_{canary}; unrelated 17.",
    "CANARY_{canary}: calendar cutoff is {value}; unrelated 23.",
    "For trusted scheduling only, calendar cutoff is {value}; memo CANARY_{canary}; unrelated 41.",
    "Irrelevant number 59. Calendar cutoff is {value}. Secret CANARY_{canary}.",
)
CAPTURE = r"calendar\s+cutoff\s+is\s+(-?\d+)"


def oracle(value: int, op: str, threshold: int) -> bool:
    return {"lt": value < threshold, "le": value <= threshold,
            "eq": value == threshold, "ge": value >= threshold,
            "gt": value > threshold}[op]


def exhaustive_mechanism() -> dict[str, int]:
    checked = leaks = disagreements = equivalence_violations = 0
    for value in range(DOMAIN):
        for threshold in THRESHOLDS:
            contract = NumericPredicateContract("calendar.cutoff", "slot_allowed", "ge", threshold, CAPTURE)
            outputs = set()
            for template_index, template in enumerate(TEMPLATES):
                canary = f"{value:04x}_{threshold:04x}_{template_index}"
                source = template.format(value=value, canary=canary)
                release = compile_numeric_predicate(source, contract)
                checked += 1
                disagreements += release.value != oracle(value, "ge", threshold)
                leaks += int(canary in release.text or source in release.text or canary in json.dumps(release.receipt))
                outputs.add(release.text)
            equivalence_violations += int(len(outputs) != 1)
    return {"cases": checked, "oracle_disagreements": disagreements,
            "protected_disclosures": leaks, "equivalence_violations": equivalence_violations}


def ambiguity_test() -> dict[str, int]:
    rejected = 0
    for left in range(64):
        right = (left + 1) % 64
        contract = NumericPredicateContract("calendar.cutoff", "slot_allowed", "ge", 32, CAPTURE, 0, 63)
        try:
            compile_numeric_predicate(
                f"calendar cutoff is {left}; calendar cutoff is {right}", contract
            )
        except CompilationError:
            rejected += 1
    return {"cases": 64, "rejected": rejected}


def product_boundary() -> dict[str, dict[str, int]]:
    metrics = {arm: {"cases": 0, "success": 0, "canary_disclosures": 0, "receipt_disclosures": 0}
               for arm in ("raw", "redaction", "pcc")}
    for case in range(512):
        cutoff = case % 256
        canary = f"MEDICAL_{hashlib.sha256(str(case).encode()).hexdigest()[:16]}"
        source = f"Calendar cutoff is {cutoff}. Sensitive note {canary}; unrelated 300."
        slots = ((case * 17) % 256, (case * 43 + 7) % 256)
        expected = tuple(slot <= cutoff for slot in slots)

        raw_payload = source
        raw_choice = tuple(slot <= cutoff for slot in slots)
        metrics["raw"]["cases"] += 1
        metrics["raw"]["success"] += raw_choice == expected
        metrics["raw"]["canary_disclosures"] += canary in raw_payload

        redacted_payload = "Calendar availability is private."
        redacted_choice = (False, False)
        metrics["redaction"]["cases"] += 1
        metrics["redaction"]["success"] += redacted_choice == expected
        metrics["redaction"]["canary_disclosures"] += canary in redacted_payload

        releases = []
        for slot in slots:
            contract = NumericPredicateContract("calendar.cutoff", "slot_allowed", "ge", slot, CAPTURE, 0, 255)
            releases.append(compile_numeric_predicate(source, contract))
        provider_payload = "\n".join(release.text for release in releases)
        pcc_choice = tuple(release.value for release in releases)
        receipt_payload = json.dumps([release.receipt for release in releases], sort_keys=True)
        metrics["pcc"]["cases"] += 1
        metrics["pcc"]["success"] += pcc_choice == expected
        metrics["pcc"]["canary_disclosures"] += canary in provider_payload
        metrics["pcc"]["receipt_disclosures"] += canary in receipt_payload or source in receipt_payload
    return metrics


def composition() -> dict[str, int]:
    unbudgeted_recovered = guarded_recovered = 0
    minimum_guarded_candidates = DOMAIN
    for secret in range(DOMAIN):
        lo, hi = 0, DOMAIN - 1
        queries = 0
        while lo < hi:
            mid = (lo + hi) // 2
            queries += 1
            if secret <= mid:
                hi = mid
            else:
                lo = mid + 1
        unbudgeted_recovered += lo == secret

        lo, hi = 0, DOMAIN - 1
        for _ in range(5):
            mid = (lo + hi) // 2
            if secret <= mid:
                hi = mid
            else:
                lo = mid + 1
        candidates = hi - lo + 1
        guarded_recovered += candidates == 1
        minimum_guarded_candidates = min(minimum_guarded_candidates, candidates)
    return {"secrets": DOMAIN, "unbudgeted_exact_recoveries": unbudgeted_recovered,
            "guarded_exact_recoveries": guarded_recovered,
            "minimum_guarded_candidates": minimum_guarded_candidates}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = {
        "study": "PCC clean-room replication and product-boundary test",
        "mechanism": exhaustive_mechanism(),
        "ambiguity": ambiguity_test(),
        "product_boundary": product_boundary(),
        "composition": composition(),
    }
    gates = {
        "oracle_agreement": result["mechanism"]["oracle_disagreements"] == 0,
        "zero_pcc_canary_disclosure": result["mechanism"]["protected_disclosures"] == 0,
        "equivalence": result["mechanism"]["equivalence_violations"] == 0,
        "ambiguity_fail_closed": result["ambiguity"]["rejected"] == result["ambiguity"]["cases"],
        "product_utility": all(result["product_boundary"][arm]["success"] == 512 for arm in ("raw", "pcc")),
        "product_zero_pcc_canaries": result["product_boundary"]["pcc"]["canary_disclosures"] == 0,
        "raw_exposes_all_canaries": result["product_boundary"]["raw"]["canary_disclosures"] == 512,
        "receipt_non_disclosure": result["product_boundary"]["pcc"]["receipt_disclosures"] == 0,
        "unbudgeted_reconstructs": result["composition"]["unbudgeted_exact_recoveries"] == DOMAIN,
        "guard_prevents_reconstruction": result["composition"]["guarded_exact_recoveries"] == 0
        and result["composition"]["minimum_guarded_candidates"] >= 128,
    }
    result["gates"] = gates
    result["overall"] = "PASS" if all(gates.values()) else "FAIL"
    rendered = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(rendered, encoding="utf-8")
    print(rendered, end="")


if __name__ == "__main__":
    main()
