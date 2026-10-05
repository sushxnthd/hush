#!/usr/bin/env python3
"""Development-only v1h: hybrid broad recall + selective task-evidence gating.

v1f retained high utility but leaked too much context. v1g drove leakage near zero
but collapsed utility because every candidate had to survive a strict relevance band.
v1h combines the two mechanisms without using failure-mode labels at selection time:

* retain a bounded high-recall core from the v1f lineage-aware ranking;
* apply v1g-style positive task evidence to the tail instead of globally;
* within the core, candidates carrying a stronger privacy signal still require
  positive task evidence;
* use recipient/purpose mismatch and generic sensitivity only as local policy
  signals; gold annotations are never available to ranking;
* sweep only development data while excluding frozen holdout ids.

A configuration may become a confirmatory candidate only if it passes the same
pre-existing freeze-readiness gates used by v1f/v1g. The frozen holdout remains
untouched until one mechanism is selected and preregistered.
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
MAX_SPANS = 32

CONFIGS = []
for core_spans, privacy_trigger, direct_override, evidence_delta in itertools.product(
    (12, 16, 20, 24, 28),
    (0.15, 0.30, 0.45),
    (0.15, 0.25, 0.35),
    (0.55, 0.70, 0.85),
):
    CONFIGS.append({
        "id": (
            f"c{core_spans}_p{int(privacy_trigger*100):02d}_"
            f"o{int(direct_override*100):02d}_d{int(evidence_delta*100):02d}"
        ),
        "core_spans": core_spans,
        "privacy_trigger": privacy_trigger,
        "direct_override": direct_override,
        "evidence_delta": evidence_delta,
    })


def choose_semantic(row: dict[str, Any]) -> list[str]:
    c = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r: (-r["semantic"], base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:MAX_SPANS]]


def choose_lexical(row: dict[str, Any]) -> list[str]:
    c = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r: (-r["lexical"], -r["semantic"], base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:MAX_SPANS]]


def candidate_rows(row: dict[str, Any], query: str) -> list[dict[str, Any]]:
    c = row["candidates"]
    ranked = []
    for r in row["ranked"]:
        candidate = c[r["idx"]]
        risk = atom.sensitivity(candidate)
        override = r["override"]
        generic = risk * (1 - override)
        # Keep v1f's fail-closed generic hard gate.
        if generic >= RISK_GATE and override < 0.60:
            continue
        rmis = ctx.recipient_mismatch(query, candidate)
        pmis = ctx.purpose_mismatch(query, candidate)
        contextual = max(rmis * (1 - 0.20 * override), pmis * (1 - 0.35 * override))
        score = r["semantic"] + 0.12 * r["lexical"] - RISK_PENALTY * generic
        ranked.append({
            **r,
            "score": score,
            "generic": generic,
            "contextual": contextual,
            "privacy_signal": max(generic, contextual),
        })
    ranked.sort(key=lambda r: (-r["score"], -r["semantic"], base.norm(c[r["idx"]].release)))
    return ranked


def choose_hush(row: dict[str, Any], query: str, cfg: dict[str, Any]) -> list[str]:
    c = row["candidates"]
    ranked = candidate_rows(row, query)
    if not ranked:
        return []
    best = ranked[0]["score"]
    selected = []
    for pos, r in enumerate(ranked):
        # Evidence is intentionally permissive compared with v1g. Direct lexical
        # evidence always counts; semantic evidence uses a wide relative band.
        evidence = (
            r["override"] >= cfg["direct_override"]
            or r["score"] >= best - cfg["evidence_delta"]
        )
        in_core = pos < cfg["core_spans"]
        suspicious = r["privacy_signal"] >= cfg["privacy_trigger"]

        # High-recall core: preserve v1f recall unless the candidate itself carries
        # enough privacy signal to demand positive task evidence.
        if in_core:
            if suspicious and not evidence:
                continue
            selected.append(r)
        # Tail: unlike v1f, release only with positive task evidence.
        elif evidence:
            selected.append(r)

        if len(selected) >= MAX_SPANS:
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
    ap.add_argument("--output", type=Path, default=Path("agentcibench-dev-v1h.json"))
    args = ap.parse_args()

    base.flatten_candidates = ctx.flatten_candidates_contextual
    scenarios = base.load_scenarios(args.dev_dir, args.holdout_dir, base.DEV_PER_MODE)
    if len(scenarios) < 30:
        raise RuntimeError("Too few development scenarios")
    if any((args.holdout_dir / f"{s['scenario_id']}.json").exists() for s in scenarios):
        raise RuntimeError("Confirmatory contamination")

    models = base.run_models(scenarios)
    out = {
        "status": "DEVELOPMENT_ONLY_V1H",
        "mechanism": "high_recall_core_with_privacy_triggered_evidence_and_evidence_tail",
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
            eligible.append((
                h["minimal_success_rate"], h["leak_free_rate"], -h["mean_violation"],
                h["mean_completeness"], -h["mean_released_chars"], cfg["id"],
            ))

    eligible.sort(reverse=True)
    out["selected_config"] = eligible[0][-1] if eligible else None

    # Also print the Pareto-near candidates even when nothing clears every gate,
    # so a branch kill remains informative rather than opaque.
    ranked_configs = []
    for cid, row in out["configs"].items():
        h = row["summary"]["hush_ci"]
        ranked_configs.append((
            h["minimal_success_rate"],
            h["mean_completeness"],
            h["leak_free_rate"],
            -h["mean_violation"],
            cid,
        ))
    ranked_configs.sort(reverse=True)
    printed = []
    if eligible:
        printed.extend([x[-1] for x in eligible[:8]])
    for *_, cid in ranked_configs:
        if cid not in printed:
            printed.append(cid)
        if len(printed) >= 12:
            break
    for cid in printed:
        row = out["configs"][cid]
        h = row["summary"]["hush_ci"]
        p = row["paired_leak_free_vs_semantic"]
        amb = row["subgroups"].get("task_ambiguity_overshare", {}).get("hush_ci", {})
        print(
            f"{cid:24s} ready={row['freeze_ready']} comp={h['mean_completeness']:.3f} "
            f"useful={h['fully_useful_rate']:.3f} leak={h['leak_free_rate']:.3f} "
            f"success={h['minimal_success_rate']:.3f} viol={h['mean_violation']:.3f} "
            f"spans={h['mean_released_spans']:.1f} amb_comp={amb.get('mean_completeness', float('nan')):.3f} "
            f"amb_viol={amb.get('mean_violation', float('nan')):.3f} H/S={p['left_only']}/{p['right_only']} "
            f"p={p['p_two_sided']:.4g}"
        )
    print("freeze_ready_count=" + str(len(eligible)))
    print("selected_config=" + str(out["selected_config"]))
    args.output.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if out["selected_config"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
