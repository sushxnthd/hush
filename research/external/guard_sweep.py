#!/usr/bin/env python3
"""Post-hoc development sweep on the already-opened v2 corpus.

This file is explicitly NOT confirmatory evidence. It selects one fixed copied-
context guard configuration before the untouched PrivacyLens holdout is opened.
"""
from __future__ import annotations

import json
import math
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
    pairwise,
    preservation,
    summarize,
    transform_agentleak,
    transform_hush,
)

CONFIGS=((4,18),(5,18),(5,24),(6,18),(6,24),(7,24))
V3_DEVELOPMENT_PACK="privacylens_ci"


def exact_two_sided(wins,losses):
    n=wins+losses
    if not n:return 1.0
    k=min(wins,losses)
    return min(1.0,2*sum(math.comb(n,i) for i in range(k+1))/(2**n))


def paired_leakfree(rows,left_arm,right_arm,pack=None):
    def selected(arm):
        return {
            (r["pack"],r["scenario"]): r["leaked_secrets"]==0
            for r in rows if r["arm"]==arm and (pack is None or r["pack"]==pack)
        }
    left,right=selected(left_arm),selected(right_arm)
    keys=sorted(set(left)&set(right))
    left_only=sum(left[k] and not right[k] for k in keys)
    right_only=sum(right[k] and not left[k] for k in keys)
    return {
        "n":len(keys),"left_only_leak_free":left_only,"right_only_leak_free":right_only,
        "both_leak_free":sum(left[k] and right[k] for k in keys),
        "neither_leak_free":sum((not left[k]) and (not right[k]) for k in keys),
        "two_sided_exact_p":exact_two_sided(left_only,right_only),
    }


def run_guard(records,repo_root,min_tokens,min_chars):
    items=[]
    for sidx,record in enumerate(records):
        trace=record["trace"]
        protected=[e.content for e in trace.events if e.channel_value in SOURCE_CHANNELS_FOR_POSTHOC_GUARD]
        for eidx,event in enumerate(trace.events):
            if event.channel_value in DISCLOSURE_CHANNELS:
                items.append({"id":f"{sidx}:{eidx}","content":event.content,"protectedValues":protected})
    helper=repo_root/"research"/"external"/"hush-guard-batch.mjs"
    proc=subprocess.run(
        ["node",str(helper)],
        input=json.dumps({"mode":"pseudonymous","minTokens":min_tokens,"minChars":min_chars,"items":items},ensure_ascii=False),
        text=True,capture_output=True,check=True,
    )
    payload=json.loads(proc.stdout)
    return {str(row["id"]):row["sanitized"] for row in payload["results"]}


def main():
    repo_root=Path(__file__).resolve().parents[2]
    records=[]
    for pack,expected in PACK_COUNTS.items():
        entries=expand_pack(pack)
        if len(entries)!=expected:raise RuntimeError(f"pack drift: {pack} expected={expected} got={len(entries)}")
        for meta,trace in entries:records.append({"pack":pack,"meta":meta,"trace":trace})

    runner=AgentLeakRunner(); sanitizer=Sanitizer(style="placeholder"); rows=[]
    for sidx,record in enumerate(records):
        original=record["trace"];meta=record["meta"];pack=record["pack"]
        scenario=str(meta.get("origin_id") or meta.get("name") or original.scenario_id or sidx)
        trace=transform_agentleak(original,sanitizer);report=analyze(runner,trace,meta)
        rows.append({"pack":pack,"scenario":scenario,"arm":"agentleak_sanitizer","privacy_score":report["privacy_score"],"leaked_secrets":report["summary"]["leaked_secrets"],"preservation":preservation(original,trace)})

    for min_tokens,min_chars in CONFIGS:
        arm=f"guard_t{min_tokens}_c{min_chars}"; transformed=run_guard(records,repo_root,min_tokens,min_chars)
        for sidx,record in enumerate(records):
            original=record["trace"];meta=record["meta"];pack=record["pack"]
            scenario=str(meta.get("origin_id") or meta.get("name") or original.scenario_id or sidx)
            trace=transform_hush(original,sidx,transformed);report=analyze(runner,trace,meta)
            rows.append({"pack":pack,"scenario":scenario,"arm":arm,"privacy_score":report["privacy_score"],"leaked_secrets":report["summary"]["leaked_secrets"],"preservation":preservation(original,trace)})

    agent=summarize(rows,"agentleak_sanitizer")
    agent_dev=agent["per_pack"][V3_DEVELOPMENT_PACK]
    dev_floor=.8*agent_dev["mean_preservation"]
    result={"status":"POSTHOC_DEVELOPMENT_ONLY","n":len(records),"v3_development_pack":V3_DEVELOPMENT_PACK,"agentleak_sanitizer":agent,"v3_development_preservation_floor":dev_floor,"configs":{}}
    print(f"PrivacyLens development: AgentLeak leak-free={agent_dev['leak_free_rate']:.3%} privacy={agent_dev['mean_privacy_score']:.2f} preservation={agent_dev['mean_preservation']:.4f}")
    print(f"PrivacyLens 80% preservation floor={dev_floor:.4f}")

    for min_tokens,min_chars in CONFIGS:
        arm=f"guard_t{min_tokens}_c{min_chars}"; summary=summarize(rows,arm); paired_score=pairwise(rows,arm,"agentleak_sanitizer"); paired_dev=paired_leakfree(rows,arm,"agentleak_sanitizer",V3_DEVELOPMENT_PACK)
        dev=summary["per_pack"][V3_DEVELOPMENT_PACK]
        result["configs"][arm]={"summary":summary,"paired_privacy_score":paired_score,"privacyLens_dev_paired_leakfree":paired_dev}
        print(f"{arm:16s} PL leak-free={dev['leak_free_rate']:.3%} privacy={dev['mean_privacy_score']:.2f} preservation={dev['mean_preservation']:.4f} H-only/A-only={paired_dev['left_only_leak_free']}/{paired_dev['right_only_leak_free']} p={paired_dev['two_sided_exact_p']:.6g}")

    eligible=[]
    for arm,data in result["configs"].items():
        dev=data["summary"]["per_pack"][V3_DEVELOPMENT_PACK]
        if dev["mean_preservation"]>=dev_floor and dev["leak_free_rate"]>agent_dev["leak_free_rate"]:
            eligible.append((arm,data))
    eligible.sort(key=lambda pair:(pair[1]["summary"]["per_pack"][V3_DEVELOPMENT_PACK]["leak_free_rate"],pair[1]["summary"]["per_pack"][V3_DEVELOPMENT_PACK]["mean_privacy_score"],pair[1]["summary"]["per_pack"][V3_DEVELOPMENT_PACK]["mean_preservation"]),reverse=True)
    result["selected_for_v3"]=eligible[0][0] if eligible else None
    print(f"selected_for_v3={result['selected_for_v3']}")
    Path("guard-sweep-v2.json").write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")

if __name__=="__main__":main()
