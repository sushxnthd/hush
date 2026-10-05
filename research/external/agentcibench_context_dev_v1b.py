#!/usr/bin/env python3
"""Second development sweep for AgentCIBench.

Changes from v1 are development-only and are motivated by a calibration bug found
in the first sweep: the MS-MARCO sigmoid scores were far below the preregistered
absolute cutoffs, so almost no spans were released. v1b removes that inappropriate
absolute cutoff, uses a fixed release budget, and counts the user task itself as
already-authorized context available to every arm.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentcibench_context_dev_v1 as base

CONFIGS = (
    {"id":"k4_r18","max_spans":4,"risk_penalty":0.18,"hard_gate":False},
    {"id":"k6_r22","max_spans":6,"risk_penalty":0.22,"hard_gate":False},
    {"id":"k8_r26","max_spans":8,"risk_penalty":0.26,"hard_gate":False},
    {"id":"k10_r30","max_spans":10,"risk_penalty":0.30,"hard_gate":False},
    {"id":"k12_r34","max_spans":12,"risk_penalty":0.34,"hard_gate":False},
    {"id":"k16_r38","max_spans":16,"risk_penalty":0.38,"hard_gate":False},
    {"id":"k12_r34_gate","max_spans":12,"risk_penalty":0.34,"hard_gate":True},
    {"id":"k16_r38_gate","max_spans":16,"risk_penalty":0.38,"hard_gate":True},
)


def choose_semantic(row: dict[str, Any], config: dict[str, Any]) -> list[str]:
    cands = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r:(-r["semantic"], base.norm(cands[r["idx"]].release)))
    return [cands[r["idx"]].release for r in ranked[:config["max_spans"]]]


def choose_lexical(row: dict[str, Any], config: dict[str, Any]) -> list[str]:
    cands = row["candidates"]
    ranked = sorted(row["ranked"], key=lambda r:(-r["lexical"],-r["semantic"],base.norm(cands[r["idx"]].release)))
    return [cands[r["idx"]].release for r in ranked[:config["max_spans"]]]


def choose_hush(row: dict[str, Any], config: dict[str, Any]) -> list[str]:
    cands = row["candidates"]
    rescored=[]
    for r in row["ranked"]:
        effective_risk=r["risk"]*(1-r["override"])
        if config["hard_gate"] and effective_risk>=0.45 and r["override"]<0.55:
            continue
        value=r["semantic"]+0.10*r["lexical"]-config["risk_penalty"]*effective_risk
        rescored.append({**r,"score":value})
    rescored.sort(key=lambda r:(-r["score"],-r["semantic"],base.norm(cands[r["idx"]].release)))
    return [cands[r["idx"]].release for r in rescored[:config["max_spans"]]]


def build_report(scenarios, model_rows):
    result={"status":"DEVELOPMENT_ONLY_V1B","scenarios":len(scenarios),"configs":{},"selected_config":None}
    for config in CONFIGS:
        rows=[]
        for scenario in scenarios:
            sid=str(scenario["scenario_id"]);model_row=model_rows[sid]
            public=[str(scenario["task_prompt"])]
            arms={
                "raw_context":public+[c.release for c in model_row["candidates"]],
                "semantic_only":public+choose_semantic(model_row,config),
                "lexical_minimization":public+choose_lexical(model_row,config),
                "hush_ci":public+choose_hush(model_row,config),
            }
            gt=scenario["ground_truth"]
            for arm,values in arms.items():
                rows.append({"scenario_id":sid,"failure_mode":str(scenario.get("failure_mode") or "unknown"),"arm":arm,**base.score(values,gt)})
        summary={arm:base.aggregate(rows,arm) for arm in ("raw_context","semantic_only","lexical_minimization","hush_ci")}
        pair=base.paired(rows,"hush_ci","semantic_only","leak_free")
        subgroups={}
        for mode in sorted({r["failure_mode"] for r in rows}):
            mr=[r for r in rows if r["failure_mode"]==mode]
            subgroups[mode]={arm:base.aggregate(mr,arm) for arm in ("semantic_only","lexical_minimization","hush_ci")}
        eligible=summary["hush_ci"]["mean_completeness"]>=0.90 and summary["hush_ci"]["fully_useful_rate"]>=0.75
        result["configs"][config["id"]]={"config":config,"eligible":eligible,"summary":summary,"paired_leak_free_vs_semantic":pair,"subgroups":subgroups}
        h,s,l=summary["hush_ci"],summary["semantic_only"],summary["lexical_minimization"]
        print(f"{config['id']:14s} H comp={h['mean_completeness']:.3f} useful={h['fully_useful_rate']:.3f} leakfree={h['leak_free_rate']:.3f} success={h['minimal_success_rate']:.3f} viol={h['mean_violation']:.3f} | S comp={s['mean_completeness']:.3f} leakfree={s['leak_free_rate']:.3f} success={s['minimal_success_rate']:.3f} | L success={l['minimal_success_rate']:.3f} H/S={pair['left_only']}/{pair['right_only']} p={pair['p_two_sided']:.4g} eligible={eligible}")
    eligible=[]
    for cid,row in result["configs"].items():
        if row["eligible"]:
            h=row["summary"]["hush_ci"]
            eligible.append((h["minimal_success_rate"],h["leak_free_rate"],h["mean_completeness"],-h["mean_violation"],-h["mean_released_chars"],cid))
    eligible.sort(reverse=True);result["selected_config"]=eligible[0][-1] if eligible else None
    raw=next(iter(result["configs"].values()))["summary"]["raw_context"]
    result["raw_context_ceiling"]=raw
    print(f"raw_context comp={raw['mean_completeness']:.3f} useful={raw['fully_useful_rate']:.3f} leakfree={raw['leak_free_rate']:.3f} viol={raw['mean_violation']:.3f}")
    print(f"selected_config={result['selected_config']}")
    return result


def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument("--dev-dir",type=Path,required=True);ap.add_argument("--holdout-dir",type=Path,required=True);ap.add_argument("--per-mode",type=int,default=base.DEV_PER_MODE);ap.add_argument("--output",type=Path,default=Path("agentcibench-dev-v1b.json"));args=ap.parse_args()
    scenarios=base.load_scenarios(args.dev_dir,args.holdout_dir,args.per_mode)
    if len(scenarios)<30: raise RuntimeError(f"Too few development scenarios: {len(scenarios)}")
    if any((args.holdout_dir/f"{s['scenario_id']}.json").exists() for s in scenarios): raise RuntimeError("Confirmatory scenario contaminated development selection")
    print(f"development-v1b scenarios={len(scenarios)}")
    result=build_report(scenarios,base.run_models(scenarios));args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    return 0 if result["selected_config"] else 2

if __name__=="__main__": raise SystemExit(main())
