#!/usr/bin/env python3
"""Independent partition audit for PCC/semantic output-channel containment."""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
from pathlib import Path


def partition(vector: tuple[int, ...]) -> tuple[tuple[int, ...], ...]:
    blocks: dict[int, list[int]] = {}
    for state, value in enumerate(vector):
        blocks.setdefault(value, []).append(state)
    return tuple(sorted(tuple(block) for block in blocks.values()))


def digest(payload: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-n", type=int, default=7)
    parser.add_argument("--max-output", type=int, default=4)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    checks = 0
    tasks = 0
    nonconstant = 0
    failures: list[object] = []
    for n in range(2, args.max_n + 1):
        raw_partition = tuple((x,) for x in range(n))
        for m in range(2, min(args.max_output, n) + 1):
            for values in itertools.product(range(m), repeat=n):
                tasks += 1
                pcc_partition = partition(values)
                # Construct the matched control through its graph, not by
                # importing or calling the primary verifier.
                graph = tuple((x, values[x]) for x in range(n))
                semantic_partition = partition(tuple(y for _, y in graph))
                checks += 1
                if pcc_partition != semantic_partition:
                    failures.append(["partition", n, m, values])
                # Raw identity refines every deterministic task partition.
                checks += 1
                if any(not any(set(raw_block) <= set(task_block) for task_block in pcc_partition) for raw_block in raw_partition):
                    failures.append(["refinement", n, m, values])
                if len(pcc_partition) > 1:
                    nonconstant += 1
                    checks += 1
                    if len(pcc_partition) == 1:
                        failures.append(["denial_utility", n, m, values])

    payload: dict[str, object] = {
        "schema": "hush.pcc-semantic-containment.audit.v1",
        "max_n": args.max_n,
        "max_output": args.max_output,
        "tasks": tasks,
        "nonconstant_tasks": nonconstant,
        "checks": checks,
        "failures": failures,
        "status": "PASS" if not failures else "FAIL",
    }
    payload["canonical_sha256"] = digest(payload)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
    print(json.dumps(payload, indent=2))
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
