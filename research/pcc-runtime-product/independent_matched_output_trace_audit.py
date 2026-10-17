#!/usr/bin/env python3
"""Independent formula/enumeration audit; deliberately does not import the primary verifier."""

import json
from pathlib import Path


def main():
    fibers = mixed = pairs = instances = 0
    for r in range(1, 5):
        for a in range(1, 4):
            k = r + a
            fibers += 2 * (2 ** k)
            instances += 2 * (4 ** k)
            # For an allow mask with popcount j, 2^j traces are safe.
            for policy in range(1 << k):
                safe_count = 1 << policy.bit_count()
                unsafe_count = (1 << k) - safe_count
                if unsafe_count:
                    mixed += 2
                    pairs += 2 * safe_count * unsafe_count

    primary = json.loads(Path(__file__).with_name("matched_output_trace_enforcement_results.json").read_text())
    audit = {
        "formula_counts": {
            "policy_output_fibers": fibers,
            "mixed_safety_fibers": mixed,
            "matched_safe_unsafe_pairs": pairs,
            "classified_instances": instances,
        },
        "primary_counts": {key: primary[key] for key in (
            "policy_output_fibers", "mixed_safety_fibers", "matched_safe_unsafe_pairs", "classified_instances"
        )},
    }
    audit["exact_match"] = audit["formula_counts"] == audit["primary_counts"]
    target = Path(__file__).with_name("matched_output_trace_enforcement_independent_audit.json")
    target.write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n")
    print(json.dumps(audit, indent=2, sort_keys=True))
    raise SystemExit(0 if audit["exact_match"] else 1)


if __name__ == "__main__":
    main()
