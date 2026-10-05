#!/usr/bin/env python3
"""Post-hoc development sweep on the already-opened v2 corpus.

This file is explicitly NOT confirmatory evidence. It exists to select one fixed
copied-context guard configuration before evaluating the untouched PrivacyLens
holdout in Protocol v3.
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

from agentleak import AgentLeakRunner
from agentleak.defenses.sanitizer import Sanitizer
from agentleak.scenarios.packs import expand_pack

from agentleak_v2 import (
    PACK_COUNTS,
    DISCLOSURE_CHANNELS,
    SOURCE_CHANNELS_FOR_POSTHOC_GUARD,
    analyze,
    clone_trace,
    pairwise,
    preservation,
    summarize,
    transform_agentleak,
    transform_hush,
)

CONFIGS = (
    (4, 18),
    (5, 18),
    (5, 24),
    (6, 18),
    (6, 24),
    (7, 24),
)


def run_guard(records, repo_root: Path, min_tokens: int, min_chars: int):
    items = []
    for sidx, record in enumerate(records):
        trace = record["trace"]
        protected = [
            event.content for event in trace.events
            if event.channel_value in SOURCE_CHANNELS_FOR_POSTHOC_GUARD
        ]
        for eidx, event in enumerate(trace.events):
            if event.channel_value in DISCLOSURE_CHANNELS:
                items.append({
                    "id": f"{sidx}:{eidx}",
                    "content": event.content,
                    "protectedValues": protected,
                })
    helper = repo_root / "research" / "external" / "hush-guard-batch.mjs"
    proc = subprocess.run(
        ["node", str(helper)],
        input=json.dumps({
            "mode": "pseudonymous",
            "minTokens": min_tokens,
            "minChars": min_chars,
            "items": items,
        }, ensure_ascii=False),
        text=True,
        capture_output=True,
        check=True,
    )
    payload = json.loads(proc.stdout)
    return {str(row["id"]): row["sanitized"] for row in payload["results"]}


def main():
    repo_root = Path(__file__).resolve().parents[2]
    records = []
    for pack, expected in PACK_COUNTS.items():
        entries = expand_pack(pack)
        if len(entries) != expected:
            raise RuntimeError(f"pack drift: {pack} expected={expected} got={len(entries)}")
        for meta, trace in entries:
            records.append({"pack": pack, "meta": meta, "trace": trace})

    runner = AgentLeakRunner()
    baseline_sanitizer = Sanitizer(style="placeholder")
    rows = []
    for sidx, record in enumerate(records):
        original = record["trace"]
        meta = record["meta"]
        pack = record["pack"]
        scenario = str(meta.get("origin_id") or meta.get("name") or original.scenario_id or sidx)
        trace = transform_agentleak(original, baseline_sanitizer)
        report = analyze(runner, trace, meta)
        rows.append({
            "pack": pack,
            "scenario": scenario,
            "arm": "agentleak_sanitizer",
            "privacy_score": report["privacy_score"],
            "leaked_secrets": report["summary"]["leaked_secrets"],
            "preservation": preservation(original, trace),
        })

    for min_tokens, min_chars in CONFIGS:
        arm = f"guard_t{min_tokens}_c{min_chars}"
        transformed = run_guard(records, repo_root, min_tokens, min_chars)
        for sidx, record in enumerate(records):
            original = record["trace"]
            meta = record["meta"]
            pack = record["pack"]
            scenario = str(meta.get("origin_id") or meta.get("name") or original.scenario_id or sidx)
            trace = transform_hush(original, sidx, transformed)
            report = analyze(runner, trace, meta)
            rows.append({
                "pack": pack,
                "scenario": scenario,
                "arm": arm,
                "privacy_score": report["privacy_score"],
                "leaked_secrets": report["summary"]["leaked_secrets"],
                "preservation": preservation(original, trace),
            })

    agent = summarize(rows, "agentleak_sanitizer")
    floor = 0.8 * agent["mean_preservation"]
    result = {
        "status": "POSTHOC_DEVELOPMENT_ONLY",
        "n": len(records),
        "agentleak_sanitizer": agent,
        "preservation_floor_for_reference": floor,
        "configs": {},
    }
    print(f"AgentLeak sanitizer: leak-free={agent['leak_free_rate']:.3%} privacy={agent['mean_privacy_score']:.2f} preservation={agent['mean_preservation']:.4f}")
    print(f"80% preservation reference floor={floor:.4f}")
    for min_tokens, min_chars in CONFIGS:
        arm = f"guard_t{min_tokens}_c{min_chars}"
        summary = summarize(rows, arm)
        paired = pairwise(rows, arm, "agentleak_sanitizer")
        result["configs"][arm] = {"summary": summary, "paired_privacy_score": paired}
        print(
            f"{arm:16s} leak-free={summary['leak_free_rate']:.3%} "
            f"privacy={summary['mean_privacy_score']:.2f} preservation={summary['mean_preservation']:.4f} "
            f"wins/losses/ties={paired['wins']}/{paired['losses']}/{paired['ties']} p={paired['two_sided_exact_sign_p']:.6g}"
        )

    eligible = [
        (arm, data) for arm, data in result["configs"].items()
        if data["summary"]["mean_preservation"] >= floor
        and data["summary"]["leak_free_rate"] > agent["leak_free_rate"]
    ]
    eligible.sort(key=lambda pair: (
        pair[1]["summary"]["leak_free_rate"],
        pair[1]["summary"]["mean_privacy_score"],
        pair[1]["summary"]["mean_preservation"],
    ), reverse=True)
    result["selected_for_v3"] = eligible[0][0] if eligible else None
    print(f"selected_for_v3={result['selected_for_v3']}")
    Path("guard-sweep-v2.json").write_text(json.dumps(result, indent=2, sort_keys=True)+"\n", encoding="utf-8")


if __name__ == "__main__":
    main()
