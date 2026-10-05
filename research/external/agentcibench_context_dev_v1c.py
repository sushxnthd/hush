#!/usr/bin/env python3
"""Third AgentCIBench development sweep: atomic disclosure + wider recall.

Development-only. It never reads the reserved e2e holdout bodies. The change is
principled rather than benchmark-specific: Hush should not release a whole compound
blob when a smaller atomic span can satisfy the same task.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentcibench_context_dev_v1 as base

base.DENSE_TOP_N = 48

CONFIGS = (
    {"id":"a16_r35_g45","max_spans":16,"risk_penalty":0.35,"gate":0.45},
    {"id":"a20_r40_g45","max_spans":20,"risk_penalty":0.40,"gate":0.45},
    {"id":"a24_r45_g45","max_spans":24,"risk_penalty":0.45,"gate":0.45},
    {"id":"a28_r50_g45","max_spans":28,"risk_penalty":0.50,"gate":0.45},
    {"id":"a32_r55_g45","max_spans":32,"risk_penalty":0.55,"gate":0.45},
    {"id":"a20_r50_g35","max_spans":20,"risk_penalty":0.50,"gate":0.35},
    {"id":"a24_r60_g35","max_spans":24,"risk_penalty":0.60,"gate":0.35},
    {"id":"a28_r70_g35","max_spans":28,"risk_penalty":0.70,"gate":0.35},
)

GENERIC_SENSITIVE = (
    "medical", "health", "therapy", "diagnosis", "biopsy", "hospital", "clinic", "doctor",
    "salary", "payroll", "debt", "mortgage", "bankruptcy", "bankrupt", "financial",
    "performance warning", "performance concern", "probation", "grievance", "disciplinary",
    "divorce", "custody", "wedding", "spouse", "relationship", "childcare", "family",
    "landlord", "mold", "personal_drafts", "private", "confidential", "home address",
)


def atomic_minimal(text: str) -> list[str]:
    raw = str(text or "").strip()
    if not raw:
        return []
    children=[]
    for line in raw.splitlines():
        line=base.clean_span(line)
        if not line:
            continue
        for sentence in base.SENTENCE_SPLIT_RE.split(line):
            sentence=base.clean_span(sentence)
            if not sentence:
                continue
            clauses=[base.clean_span(x) for x in base.CLAUSE_SPLIT_RE.split(sentence)] if len(sentence)>=80 else [sentence]
            children.extend(x for x in clauses if len(x)>=2)
    out=[];seen=set()
    # A short atomic leaf is safe to keep verbatim. Compound blobs are represented
    # only by their smaller children, preventing unrelated co-located state from
    # hitchhiking on a relevant span.
    source = [raw] if len(children)<=1 and len(raw)<=240 else children
    for span in source:
        key=base.norm(span)
        if key and key not in seen:
            seen.add(key);out.append(span)
    return out


def sensitivity(candidate: base.Candidate) -> float:
    text=base.norm(candidate.path+" "+candidate.release)
    hits=sum(term in text for term in GENERIC_SENSITIVE)
    if re.search(r"\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b",text,re.I): hits+=1
    if re.search(r"\b(?:\+?\d[\d\s().-]{7,}\d)\b",text): hits+=1
    # File-system provenance itself can establish a privacy boundary even when the
    # content is innocuous-looking (e.g. personal drafts next to work files).
    if any(x in text for x in ("personal_","personal/","drafts/","private_","private/")): hits+=2
    return min(1.0,hits/2.0)


def choose_semantic(row:dict[str,Any],cfg:dict[str,Any])->list[str]:
    c=row["candidates"];ranked=sorted(row["ranked"],key=lambda r:(-r["semantic"],base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:cfg["max_spans"]]]


def choose_lexical(row:dict[str,Any],cfg:dict[str,Any])->list[str]:
    c=row["candidates"];ranked=sorted(row["ranked"],key=lambda r:(-r["lexical"],-r["semantic"],base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:cfg["max_spans"]]]


def choose_hush(row:dict[str,Any],cfg:dict[str,Any])->list[str]:
    c=row["candidates"];ranked=[]
    for r in row["ranked"]:
        risk=sensitivity(c[r["idx"]]);override=r["override"]
        effective=risk*(1-override)
        # High-risk atomic values require positive evidence that the task itself
        # names/requests their semantic neighborhood. This is local policy logic,
        # not gold-label access.
        if effective>=cfg["gate"] and override<0.60:
            continue
        score=r["semantic"]+0.12*r["lexical"]-cfg["risk_penalty"]*effective
        ranked.append({**r,"score":score})
    ranked.sort(key=lambda r:(-r["score"],-r["semantic"],base.norm(c[r["idx"]].release)))
    return [c[r["idx"]].release for r in ranked[:cfg["max_spans"]]]


def report(scenarios,models):
    result={"status":"DEVELOPMENT_ONLY_V1C","scenarios":len(scenarios),"configs":{},"selected_config":None}
    for cfg in CONFIGS:
        rows=[]
        for s in scenarios:
            sid=str(s["scenario_id"]);m=models[sid];public=[str(s["task_prompt"])]
            arms={"raw_context":public+[x.release for x in m["candidates"]],"semantic_only":public+choose_semantic(m,cfg),"lexical_minimization":public+choose_lexical(m,cfg),"hush_ci":public+choose_hush(m,cfg)}
            for arm,vals in arms.items(): rows.append({"scenario_id":sid,"failure_mode":str(s.get("failure_mode") or "unknown"),"arm":arm,**base.score(vals,s["ground_truth"])})
        sums={arm:base.aggregate(rows,arm) for arm in ("raw_context","semantic_only","lexical_minimization","hush_ci")};pair=base.paired(rows,"hush_ci","semantic_only","leak_free")
        groups={}
        for mode in sorted({r["failure_mode"] for r in rows}):
            mr=[r for r in rows if r["failure_mode"]==mode];groups[mode]={arm:base.aggregate(mr,arm) for arm in ("semantic_only","lexical_minimization","hush_ci")}
        h=sums["hush_ci"];eligible=h["mean_completeness"]>=0.90 and h["fully_useful_rate"]>=0.75
        result["configs"][cfg["id"]]={"config":cfg,"eligible":eligible,"summary":sums,"paired_leak_free_vs_semantic":pair,"subgroups":groups}
        ss=sums["semantic_only"];ll=sums["lexical_minimization"]
        print(f"{cfg['id']:15s} H comp={h['mean_completeness']:.3f} useful={h['fully_useful_rate']:.3f} leakfree={h['leak_free_rate']:.3f} success={h['minimal_success_rate']:.3f} viol={h['mean_violation']:.3f} | S comp={ss['mean_completeness']:.3f} leakfree={ss['leak_free_rate']:.3f} success={ss['minimal_success_rate']:.3f} | L success={ll['minimal_success_rate']:.3f} H/S={pair['left_only']}/{pair['right_only']} p={pair['p_two_sided']:.4g} eligible={eligible}")
    eligible=[]
    for cid,row in result["configs"].items():
        if row["eligible"]:
            h=row["summary"]["hush_ci"];eligible.append((h["minimal_success_rate"],h["leak_free_rate"],h["mean_completeness"],-h["mean_violation"],-h["mean_released_chars"],cid))
    eligible.sort(reverse=True);result["selected_config"]=eligible[0][-1] if eligible else None
    raw=next(iter(result["configs"].values()))["summary"]["raw_context"];result["raw_context_ceiling"]=raw
    print(f"raw comp={raw['mean_completeness']:.3f} useful={raw['fully_useful_rate']:.3f} leakfree={raw['leak_free_rate']:.3f} viol={raw['mean_violation']:.3f}")
    print(f"selected_config={result['selected_config']}");return result


def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument("--dev-dir",type=Path,required=True);ap.add_argument("--holdout-dir",type=Path,required=True);ap.add_argument("--per-mode",type=int,default=base.DEV_PER_MODE);ap.add_argument("--output",type=Path,default=Path("agentcibench-dev-v1c.json"));args=ap.parse_args()
    base.atomic_spans=atomic_minimal
    scenarios=base.load_scenarios(args.dev_dir,args.holdout_dir,args.per_mode)
    if len(scenarios)<30: raise RuntimeError("Too few development scenarios")
    if any((args.holdout_dir/f"{s['scenario_id']}.json").exists() for s in scenarios): raise RuntimeError("Confirmatory contamination")
    print(f"development-v1c scenarios={len(scenarios)}")
    out=report(scenarios,base.run_models(scenarios));args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+"\n",encoding="utf-8");return 0 if out["selected_config"] else 2

if __name__=="__main__": raise SystemExit(main())
