#!/usr/bin/env python3
"""Development-only v1g: task-evidence selection for contextual integrity.

v1f recovered utility after v1e showed that an aggressive best-score frontier
removed required context. The remaining dev leakage is concentrated in
``task_ambiguity_overshare``. v1g therefore tests a narrower mechanism:

* keep the v1f lineage-aware candidate representation and generic sensitivity gate;
* require positive task evidence before releasing the low-relevance tail;
* permit a deterministic direct-evidence rescue path so a must-share item is not
  discarded merely because it is not close to the single best-scoring item;
* vary only development-time thresholds and span budgets;
* exclude every frozen holdout scenario by id and never use gold labels in ranking.

Ground truth is used only after selection for development scoring. Any selected
configuration must be frozen before a confirmatory holdout run.
"""
from __future__ import annotations

import argparse
import itertools
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentcibench_context_dev_v1 as base
import agentcibench_context_dev_v1c as atom
import agentcibench_context_dev_v1e as ctx

base.DENSE_TOP_N = 48
base.atomic_spans = atom.atomic_minimal

RISK_PENALTY = 0.55
RISK_GATE = 0.60

# A compact deterministic sweep. This is intentionally development-only: the
# holdout is excluded by scenario id and its bodies are never read.
CONFIGS = []
for max_spans, abs_score, relative_delta, direct_override in itertools.product(
    (12, 16, 20, 24, 28, 32),
    (0.24, 0.30, 0.36, 0.42),
    (0.35, 0.45, 0.55, 0.65),
    (0.20, 0.35),
):
    CONFIGS.append({
        "id": f"k{max_spans}_a{int(abs_score*100):02d}_d{int(relative_delta*100):02d}_o{int(direct_override*100):02d}",
        "max_spans": max_spans,
        "abs_score": abs_score,
        "relative_delta": relative_delta,
        "direct_override": direct_override,
    })


def choose_semantic(row: dict[str, Any], max_spans: int = 32) -> list[str]:
    c = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r: (-r["semantic"], base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:max_spans]]


def choose_lexical(row: dict[str, Any], max_spans: int = 32) -> list[str]:
    c = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r: (-r["lexical"], -r["semantic"], base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:max_spans]]


def candidate_rows(row: dict[str, Any], query: str) -> list[dict[str, Any]]:
    c = row["candidates"]
    ranked = []
    for r in row["ranked"]:
        candidate = c[r["idx"]]
        risk = atom.sensitivity(candidate)
        override = r["override"]
        generic = risk * (1 - override)
        # Preserve v1f's successful generic sensitivity gate. Recipient/purpose
        # metadata stays in the model representation, but v1f showed the broad
        # contextual hard gate itself was not the source of the dev improvement.
        if generic >= RISK_GATE and override < 0.60:
            continue
        score = r["semantic"] + 0.12 * r["lexical"] - RISK_PENALTY * generic
        ranked.append({**r, "score": score})
    ranked.sort(key=lambda r: (-r["score"], -r["semantic"], base.norm(c[r["idx"]].release)))
    return ranked


def choose_hush(row: dict[str, Any], query: str, cfg: dict[str, Any]) -> list[str]:
    c = row["candidates"]
    ranked = candidate_rows(row, query)
    if not ranked:
        return []
    best = ranked[0]["score"]
    selected = []
    for r in ranked:
        # Positive task evidence can rescue a candidate outside the global
        # relevance band. The rescue is based only on query/candidate overlap
        # computed before gold scoring, never on must-share annotations.
        direct = r["override"] >= cfg["direct_override"]
        in_band = r["score"] >= cfg["abs_score"] and r["score"] >= best - cfg["relative_delta"]
        if direct or in_band:
            selected.append(r)
        if len(selected) >= cfg["max_spans"]:
            break
    return [c[r["idx"]].release for r in selected]


def subgroup_ready(rows: list[dict[str, Any]]) -> tuple[bool, dict[str, Any]]:
    groups = {}
    ready = True
    for mode in sorted({r["failure_mode"] for r in rows}):
        mr = [r for r in rows if r["failure_mode"] == mode]
        groups[mode] = {a: base.aggregate(mr, a) for a in ("semantic_only", "lexical_minimization", "hush_ci")}
        hsg, ssg = groups[mode]["hush_ci"], groups[mode]["semantic_only"]
        if hsg["n"] >= 10 and hsg["mean_completeness"] < ssg["mean_completeness"] - 0.05 - 1e-12:
            ready = False
    return ready, groups


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev-dir", type=Path, required=True)
    ap.add_argument("--holdout-dir", type=Path, required=True)
    ap.add_argument("--output", type=Path, default=Path("agentcibench-dev-v1g.json"))
    args = ap.parse_args()

    base.flatten_candidates = ctx.flatten_candidates_contextual
    scenarios = base.load_scenarios(args.dev_dir, args.holdout_dir, base.DEV_PER_MODE)
    if len(scenarios) < 30:
        raise RuntimeError("Too few development scenarios")
    if any((args.holdout_dir / f"{s['scenario_id']}.json").exists() for s in scenarios):
        raise RuntimeError("Confirmatory contamination")

    models = base.run_models(scenarios)
    out = {
        "status": "DEVELOPMENT_ONLY_V1G",
        "mechanism": "task_evidence_band_with_direct_rescue",
        "scenarios": len(scenarios),
        "configs": {},
        "selected_config": None,
    }
    eligible = []

    for cfg in CONFIGS:
        rows = []
        for s in scenarios:
            sid = str(s["scenario_id"])
            m = models[sid]
            query = str(s["task_prompt"])
            public = [query]
            arms = {
                "semantic_only": public + choose_semantic(m),
                "lexical_minimization": public + choose_lexical(m),
                "hush_ci": public + choose_hush(m, query, cfg),
            }
            for arm, vals in arms.items():
                rows.append({
                    "scenario_id": sid,
                    "failure_mode": str(s.get("failure_mode") or "unknown"),
                    "arm": arm,
                    **base.score(vals, s["ground_truth"]),
                })

        sums = {a: base.aggregate(rows, a) for a in ("semantic_only", "lexical_minimization", "hush_ci")}
        pair = base.paired(rows, "hush_ci", "semantic_only", "leak_free")
        sg_ready, groups = subgroup_ready(rows)
        h, s, l = sums["hush_ci"], sums["semantic_only"], sums["lexical_minimization"]
        ready = (
            h["mean_completeness"] >= 0.90
            and h["fully_useful_rate"] >= 0.75
            and sg_ready
            and h["leak_free_rate"] > s["leak_free_rate"]
            and h["mean_violation"] < s["mean_violation"]
            and h["minimal_success_rate"] > s["minimal_success_rate"]
            and h["minimal_success_rate"] > l["minimal_success_rate"]
            and pair["left_only"] > pair["right_only"]
            and pair["p_two_sided"] < 0.05
        )
        out["configs"][cfg["id"]] = {
            "config": cfg,
            "freeze_ready": ready,
            "summary": sums,
            "paired_leak_free_vs_semantic": pair,
            "subgroups": groups,
        }
        if ready:
            # Primary objective: successful minimal disclosure. Then leak-free rate,
            # violation, completeness, and output size. This ordering is fixed
            # before looking at the holdout.
            eligible.append((
                h["minimal_success_rate"], h["leak_free_rate"], -h["mean_violation"],
                h["mean_completeness"], -h["mean_released_chars"], cfg["id"],
            ))

    eligible.sort(reverse=True)
    out["selected_config"] = eligible[0][-1] if eligible else None

    # Print only the strongest ready candidates plus the selected one to keep CI
    # logs readable while preserving the complete grid in the JSON artifact.
    ready_rows = []
    for cid, row in out["configs"].items():
        if row["freeze_ready"]:
            h = row["summary"]["hush_ci"]
            ready_rows.append((h["minimal_success_rate"], h["leak_free_rate"], -h["mean_violation"], h["mean_completeness"], cid))
    ready_rows.sort(reverse=True)
    for _, _, _, _, cid in ready_rows[:12]:
        row = out["configs"][cid]
        h = row["summary"]["hush_ci"]
        p = row["paired_leak_free_vs_semantic"]
        amb = row["subgroups"].get("task_ambiguity_overshare", {}).get("hush_ci", {})
        print(
            f"{cid:24s} comp={h['mean_completeness']:.3f} useful={h['fully_useful_rate']:.3f} "
            f"leak={h['leak_free_rate']:.3f} success={h['minimal_success_rate']:.3f} "
            f"viol={h['mean_violation']:.3f} spans={h['mean_released_spans']:.1f} "
            f"amb_viol={amb.get('mean_violation', float('nan')):.3f} H/S={p['left_only']}/{p['right_only']} p={p['p_two_sided']:.4g}"
        )
    print("freeze_ready_count=" + str(len(ready_rows)))
    print("selected_config=" + str(out["selected_config"]))
    args.output.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if out["selected_config"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
