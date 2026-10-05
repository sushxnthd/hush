#!/usr/bin/env python3
"""Freeze a fresh AgentCIBench reserve split disjoint from all prior Hush dev sweeps.

Prior Hush development loaders selected the first DEV_PER_MODE=60 valid scenarios in
each failure mode after deterministic stable_bucket ordering, excluding e2e_50 ids.
This script reserves only rows with rank >= 60 in each mode. It does not evaluate
any mechanism and does not print or expose ground-truth contents.

The split rule is committed before v1i development results are inspected.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentcibench_context_dev_v1 as base

DEV_BOUNDARY = base.DEV_PER_MODE  # 60, frozen by prior development protocol.
MAX_RESERVE_PER_MODE = 30


def eligible_rows(dev_dir: Path, spent_holdout_dir: Path):
    spent_ids = {p.stem for p in spent_holdout_dir.glob("*.json") if p.name != "manifest.json"}
    groups = defaultdict(list)
    for path in dev_dir.glob("*.json"):
        if path.name == "manifest.json" or path.stem in spent_ids:
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        sid = str(raw.get("scenario_id") or path.stem)
        gt = raw.get("ground_truth") or {}
        if sid in spent_ids or not isinstance(raw.get("initial_states"), dict) or not raw.get("task_prompt") or not gt.get("must_share") or not gt.get("must_not_share"):
            continue
        mode = str(raw.get("failure_mode") or raw.get("scenario_family") or "unknown")
        groups[mode].append((base.stable_bucket(sid), sid, path.name))
    return groups


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev-dir", type=Path, required=True)
    ap.add_argument("--spent-holdout-dir", type=Path, required=True)
    ap.add_argument("--output", type=Path, default=Path("agentcibench-reserve-v1.json"))
    args = ap.parse_args()

    groups = eligible_rows(args.dev_dir, args.spent_holdout_dir)
    manifest = {
        "protocol": "Hush AgentCIBench fresh reserve v1",
        "rule": "stable_bucket rank >= DEV_PER_MODE within failure mode; max 30/mode",
        "dev_boundary": DEV_BOUNDARY,
        "max_reserve_per_mode": MAX_RESERVE_PER_MODE,
        "groups": {},
        "scenario_ids": [],
        "n": 0,
    }
    for mode, rows in sorted(groups.items()):
        rows.sort(key=lambda x: (x[0], x[1]))
        reserve = rows[DEV_BOUNDARY:DEV_BOUNDARY + MAX_RESERVE_PER_MODE]
        manifest["groups"][mode] = {
            "total_eligible": len(rows),
            "prior_dev_count": min(DEV_BOUNDARY, len(rows)),
            "reserve_count": len(reserve),
            "scenario_ids": [sid for _, sid, _ in reserve],
            "filenames": [name for _, _, name in reserve],
        }
        manifest["scenario_ids"].extend(sid for _, sid, _ in reserve)
    manifest["scenario_ids"] = sorted(manifest["scenario_ids"])
    manifest["n"] = len(manifest["scenario_ids"])
    args.output.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("reserve_n=" + str(manifest["n"]))
    for mode, info in manifest["groups"].items():
        print(f"{mode}: total={info['total_eligible']} prior_dev={info['prior_dev_count']} reserve={info['reserve_count']}")
    # Require enough cases for at least a useful secondary frozen test.
    return 0 if manifest["n"] >= 20 else 2


if __name__ == "__main__":
    raise SystemExit(main())
