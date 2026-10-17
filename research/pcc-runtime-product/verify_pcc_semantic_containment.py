#!/usr/bin/env python3
"""Exact verifier for the PCC/output-complete semantic containment boundary."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
from fractions import Fraction
from pathlib import Path


def priors(n: int) -> list[tuple[Fraction, ...]]:
    vectors: set[tuple[Fraction, ...]] = set()

    def add(weights: list[int]) -> None:
        total = sum(weights)
        vectors.add(tuple(Fraction(w, total) for w in weights))

    add([1] * n)
    for i in range(n):
        w = [1] * n
        w[i] = n + 1
        add(w)
    for i in range(n):
        w = [1] * n
        w[i] = 0
        add(w)
    for k in range(1, n + 1):
        add([1 if i < k else 0 for i in range(n)])
        add([1 if i >= n - k else 0 for i in range(n)])
    return sorted(vectors)


def channel_metrics(
    mapping: tuple[int, ...], prior: tuple[Fraction, ...]
) -> dict[str, object]:
    n = len(mapping)
    outputs = sorted(set(mapping))
    masses = {y: sum((prior[x] for x in range(n) if mapping[x] == y), Fraction()) for y in outputs}
    posteriors = {}
    for y in outputs:
        q = masses[y]
        posteriors[y] = tuple(
            Fraction() if q == 0 or mapping[x] != y else prior[x] / q
            for x in range(n)
        )
    prior_v = max(prior)
    posterior_v = sum(
        (max((prior[x] for x in range(n) if mapping[x] == y), default=Fraction()) for y in outputs),
        Fraction(),
    )
    realized = {}
    pml = {}
    for y in outputs:
        q = masses[y]
        if q == 0:
            continue
        branch_max = max(prior[x] for x in range(n) if mapping[x] == y)
        realized[y] = branch_max / (q * prior_v)
        pml[y] = Fraction(1, 1) / q
    entropy_output = -sum(float(q) * math.log2(float(q)) for q in masses.values() if q)
    return {
        "masses": tuple((y, masses[y]) for y in outputs),
        "posteriors": tuple((y, posteriors[y]) for y in outputs),
        "prior_vulnerability": prior_v,
        "posterior_vulnerability": posterior_v,
        "realized_charge_ratios": tuple(sorted(realized.items())),
        "pointwise_maximal_leakage_ratios": tuple(sorted(pml.items())),
        "mutual_information": entropy_output,
    }


def serial(value):
    if isinstance(value, Fraction):
        return [value.numerator, value.denominator]
    if isinstance(value, tuple):
        return [serial(x) for x in value]
    if isinstance(value, dict):
        return {k: serial(v) for k, v in value.items()}
    return value


def canonical(payload: dict[str, object]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(raw).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-n", type=int, default=7)
    parser.add_argument("--max-output", type=int, default=4)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    counts = {
        "tasks": 0,
        "nonconstant_tasks": 0,
        "prior_task_cases": 0,
        "state_transcript_checks": 0,
        "metric_checks": 0,
        "raw_dominance_checks": 0,
        "static_denial_checks": 0,
    }
    failures: list[object] = []
    per_n = []

    for n in range(2, args.max_n + 1):
        n_tasks = 0
        n_cases = 0
        ps = priors(n)
        for m in range(2, min(args.max_output, n) + 1):
            for f in itertools.product(range(m), repeat=n):
                counts["tasks"] += 1
                n_tasks += 1
                nonconstant = len(set(f)) > 1
                if nonconstant:
                    counts["nonconstant_tasks"] += 1
                    counts["static_denial_checks"] += 1
                    if all(value == f[0] for value in f):
                        failures.append(["static_denial", n, m, f])
                # Independently instantiate the observable channel in each arm.
                pcc = tuple(f[x] for x in range(n))
                semantic = tuple((lambda value: value)(f[x]) for x in range(n))
                for x in range(n):
                    counts["state_transcript_checks"] += 1
                    if pcc[x] != semantic[x]:
                        failures.append(["transcript", n, m, f, x])
                for prior in ps:
                    counts["prior_task_cases"] += 1
                    n_cases += 1
                    a = channel_metrics(pcc, prior)
                    b = channel_metrics(semantic, prior)
                    for key in (
                        "masses",
                        "posteriors",
                        "prior_vulnerability",
                        "posterior_vulnerability",
                        "realized_charge_ratios",
                        "pointwise_maximal_leakage_ratios",
                    ):
                        counts["metric_checks"] += 1
                        if a[key] != b[key]:
                            failures.append(["metric", key, n, m, f, serial(prior)])
                    counts["metric_checks"] += 1
                    if abs(float(a["mutual_information"]) - float(b["mutual_information"])) > 1e-15:
                        failures.append(["mutual_information", n, m, f, serial(prior)])

                    # Raw identity release Blackwell-dominates task output.
                    raw = channel_metrics(tuple(range(n)), prior)
                    counts["raw_dominance_checks"] += 1
                    if float(a["mutual_information"]) > float(raw["mutual_information"]) + 1e-12:
                        failures.append(["raw_mi", n, m, f, serial(prior)])
                    if a["posterior_vulnerability"] > raw["posterior_vulnerability"]:
                        failures.append(["raw_bayes", n, m, f, serial(prior)])
                    raw_pml = dict(raw["pointwise_maximal_leakage_ratios"])
                    task_pml = dict(a["pointwise_maximal_leakage_ratios"])
                    for x, px in enumerate(prior):
                        if px and task_pml[f[x]] > raw_pml[x]:
                            failures.append(["raw_pml", n, m, f, x, serial(prior)])

        per_n.append({"n": n, "priors": len(ps), "tasks": n_tasks, "prior_task_cases": n_cases})

    payload: dict[str, object] = {
        "schema": "hush.pcc-semantic-containment.v1",
        "protocol_commit": "b37403b728a4ed56e765acfcf63334d650ce4dbe",
        "max_n": args.max_n,
        "max_output": args.max_output,
        "counts": counts,
        "per_n": per_n,
        "failures": failures,
        "status": "PASS" if not failures else "FAIL",
    }
    payload["canonical_sha256"] = canonical(payload)
    args.output.write_text(json.dumps(serial(payload), indent=2, sort_keys=True) + "\n")
    print(json.dumps({"status": payload["status"], "counts": counts, "canonical_sha256": payload["canonical_sha256"]}, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
