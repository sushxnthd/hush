#!/usr/bin/env python3
"""Exact finite audit for the preregistered matched-output trace kernel."""

import itertools
import json
from pathlib import Path


def masks(n):
    return range(1 << n)


def safe(trace_r, trace_a, allow_r, allow_a):
    return trace_r & ~allow_r == 0 and trace_a & ~allow_a == 0


def monitor(trace_r, trace_a, allow_r, allow_a):
    for bit in range(max(trace_r.bit_length(), allow_r.bit_length())):
        if trace_r & (1 << bit) and not allow_r & (1 << bit):
            return False
    for bit in range(max(trace_a.bit_length(), allow_a.bit_length())):
        if trace_a & (1 << bit) and not allow_a & (1 << bit):
            return False
    return True


def run():
    summary = {
        "schema": 1,
        "ranges": {"resources": [1, 4], "actions": [1, 3], "outputs": 2},
        "policy_output_fibers": 0,
        "mixed_safety_fibers": 0,
        "matched_safe_unsafe_pairs": 0,
        "classified_instances": 0,
        "monitor_mismatches": 0,
        "trace_control_mismatches": 0,
        "sound_complete_output_only_verifiers": 0,
        "per_shape": [],
    }
    for nr in range(1, 5):
        for na in range(1, 4):
            shape = {"resources": nr, "actions": na, "instances": 0, "mixed_fibers": 0, "matched_pairs": 0}
            domain = []
            for allow_r, allow_a, trace_r, trace_a, y in itertools.product(
                masks(nr), masks(na), masks(nr), masks(na), range(2)
            ):
                truth = safe(trace_r, trace_a, allow_r, allow_a)
                observed = monitor(trace_r, trace_a, allow_r, allow_a)
                summary["monitor_mismatches"] += truth != observed
                trace_semantic_control = trace_r & ~allow_r == 0 and trace_a & ~allow_a == 0
                summary["trace_control_mismatches"] += observed != trace_semantic_control
                domain.append((y, truth))
                shape["instances"] += 1

            for allow_r, allow_a, y in itertools.product(masks(nr), masks(na), range(2)):
                outcomes = [safe(tr, ta, allow_r, allow_a) for tr, ta in itertools.product(masks(nr), masks(na))]
                n_safe = sum(outcomes)
                n_unsafe = len(outcomes) - n_safe
                summary["policy_output_fibers"] += 1
                if n_safe and n_unsafe:
                    summary["mixed_safety_fibers"] += 1
                    summary["matched_safe_unsafe_pairs"] += n_safe * n_unsafe
                    shape["mixed_fibers"] += 1
                    shape["matched_pairs"] += n_safe * n_unsafe

            # All Boolean maps from the two intended outputs to admit/deny.
            for decisions in itertools.product((False, True), repeat=2):
                is_sound = all(not decisions[y] or truth for y, truth in domain)
                is_complete = all(not truth or decisions[y] for y, truth in domain)
                summary["sound_complete_output_only_verifiers"] += is_sound and is_complete
            summary["classified_instances"] += shape["instances"]
            summary["per_shape"].append(shape)

    summary["gates"] = {
        "every_nontrivial_policy_output_fiber_is_mixed": summary["mixed_safety_fibers"] == summary["policy_output_fibers"] - 24,
        "no_sound_complete_output_only_verifier": summary["sound_complete_output_only_verifiers"] == 0,
        "monitor_exact": summary["monitor_mismatches"] == 0,
        "trace_semantic_control_exact": summary["trace_control_mismatches"] == 0,
        "nonzero_matched_pairs": summary["matched_safe_unsafe_pairs"] > 0,
    }
    summary["all_gates_pass"] = all(summary["gates"].values())
    return summary


if __name__ == "__main__":
    result = run()
    target = Path(__file__).with_name("matched_output_trace_enforcement_results.json")
    target.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n")
    print(json.dumps(result, indent=2, sort_keys=True))
    raise SystemExit(0 if result["all_gates_pass"] else 1)
