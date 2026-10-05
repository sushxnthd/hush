#!/usr/bin/env python3
"""Development-only v1f ablation of the v1e recipient/purpose boundary.

v1e cut leakage sharply but over-pruned required context. v1f keeps the holdout
untouched and isolates the cause on development data by separating:
  1) contextual lineage metadata,
  2) recipient/purpose score penalties,
  3) hard mismatch gating,
  4) adaptive relevance-frontier pruning.

No variant may become confirmatory merely by winning here; this run selects the
mechanism to preregister for a future untouched holdout.
"""
from __future__ import annotations

import argparse
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

CFG={"max_spans":32,"risk_penalty":0.55,"gate":0.60}
VARIANTS=(
    {"id":"lineage_generic","context_penalty":0.0,"hard_context":False,"frontier":None},
    {"id":"context_score_20","context_penalty":0.20,"hard_context":False,"frontier":None},
    {"id":"context_score_35","context_penalty":0.35,"hard_context":False,"frontier":None},
    {"id":"context_hard_20","context_penalty":0.20,"hard_context":True,"frontier":None},
    {"id":"context_hard_35","context_penalty":0.35,"hard_context":True,"frontier":None},
    {"id":"context_score_20_frontier55","context_penalty":0.20,"hard_context":False,"frontier":0.55},
    {"id":"context_hard_20_frontier55","context_penalty":0.20,"hard_context":True,"frontier":0.55},
)


def choose_semantic(row:dict[str,Any])->list[str]:
    c=row['candidates']
    ranked=sorted(row['ranked'],key=lambda r:(-r['semantic'],base.norm(c[r['idx']].release)))
    return [c[r['idx']].release for r in ranked[:CFG['max_spans']]]


def choose_lexical(row:dict[str,Any])->list[str]:
    c=row['candidates']
    ranked=sorted(row['ranked'],key=lambda r:(-r['lexical'],-r['semantic'],base.norm(c[r['idx']].release)))
    return [c[r['idx']].release for r in ranked[:CFG['max_spans']]]


def choose_variant(row:dict[str,Any],query:str,variant:dict[str,Any])->list[str]:
    c=row['candidates'];ranked=[]
    for r in row['ranked']:
        candidate=c[r['idx']]
        risk=atom.sensitivity(candidate);override=r['override']
        generic=risk*(1-override)
        rmis=ctx.recipient_mismatch(query,candidate)
        pmis=ctx.purpose_mismatch(query,candidate)
        contextual=max(rmis*(1-0.20*override),pmis*(1-0.35*override))
        if generic>=CFG['gate'] and override<0.60:
            continue
        # Context mismatch is only a hard block in explicit ablation variants.
        if variant['hard_context'] and contextual>=CFG['gate']:
            continue
        score=r['semantic']+0.12*r['lexical']-CFG['risk_penalty']*generic-variant['context_penalty']*contextual
        ranked.append({**r,'score':score})
    ranked.sort(key=lambda r:(-r['score'],-r['semantic'],base.norm(c[r['idx']].release)))
    if variant['frontier'] is not None and ranked:
        best=ranked[0]['score']
        ranked=[r for r in ranked if r['score']>=best-variant['frontier']]
    return [c[r['idx']].release for r in ranked[:CFG['max_spans']]]


def main()->int:
    ap=argparse.ArgumentParser();ap.add_argument('--dev-dir',type=Path,required=True);ap.add_argument('--holdout-dir',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path('agentcibench-dev-v1f.json'));args=ap.parse_args()
    base.flatten_candidates=ctx.flatten_candidates_contextual
    scenarios=base.load_scenarios(args.dev_dir,args.holdout_dir,base.DEV_PER_MODE)
    if len(scenarios)<30: raise RuntimeError('Too few development scenarios')
    if any((args.holdout_dir/f"{s['scenario_id']}.json").exists() for s in scenarios): raise RuntimeError('Confirmatory contamination')
    models=base.run_models(scenarios)
    out={'status':'DEVELOPMENT_ONLY_V1F','scenarios':len(scenarios),'variants':{},'selected_variant':None}
    eligible=[]
    for variant in VARIANTS:
        rows=[]
        for s in scenarios:
            sid=str(s['scenario_id']);m=models[sid];query=str(s['task_prompt']);public=[query]
            arms={'semantic_only':public+choose_semantic(m),'lexical_minimization':public+choose_lexical(m),'hush_ci':public+choose_variant(m,query,variant)}
            for arm,vals in arms.items(): rows.append({'scenario_id':sid,'failure_mode':str(s.get('failure_mode') or 'unknown'),'arm':arm,**base.score(vals,s['ground_truth'])})
        sums={a:base.aggregate(rows,a) for a in ('semantic_only','lexical_minimization','hush_ci')};pair=base.paired(rows,'hush_ci','semantic_only','leak_free')
        groups={};subgroup_ready=True
        for mode in sorted({r['failure_mode'] for r in rows}):
            mr=[r for r in rows if r['failure_mode']==mode];groups[mode]={a:base.aggregate(mr,a) for a in ('semantic_only','lexical_minimization','hush_ci')}
            hsg,ssg=groups[mode]['hush_ci'],groups[mode]['semantic_only']
            if hsg['n']>=10 and hsg['mean_completeness']<ssg['mean_completeness']-0.05-1e-12: subgroup_ready=False
        h,s,l=sums['hush_ci'],sums['semantic_only'],sums['lexical_minimization']
        ready=(h['mean_completeness']>=0.90 and h['fully_useful_rate']>=0.75 and subgroup_ready and h['leak_free_rate']>s['leak_free_rate'] and h['mean_violation']<s['mean_violation'] and h['minimal_success_rate']>s['minimal_success_rate'] and h['minimal_success_rate']>l['minimal_success_rate'] and pair['left_only']>pair['right_only'] and pair['p_two_sided']<0.05)
        out['variants'][variant['id']]={'variant':variant,'freeze_ready':ready,'summary':sums,'paired_leak_free_vs_semantic':pair,'subgroups':groups}
        print(f"{variant['id']:30s} H comp={h['mean_completeness']:.3f} useful={h['fully_useful_rate']:.3f} leak={h['leak_free_rate']:.3f} success={h['minimal_success_rate']:.3f} viol={h['mean_violation']:.3f} spans={h['mean_released_spans']:.1f} | S comp={s['mean_completeness']:.3f} leak={s['leak_free_rate']:.3f} viol={s['mean_violation']:.3f} H/S={pair['left_only']}/{pair['right_only']} p={pair['p_two_sided']:.4g} subgroup={subgroup_ready} ready={ready}")
        if ready: eligible.append((h['minimal_success_rate'],h['leak_free_rate'],-h['mean_violation'],h['mean_completeness'],-h['mean_released_chars'],variant['id']))
    eligible.sort(reverse=True);out['selected_variant']=eligible[0][-1] if eligible else None
    print('selected_variant='+str(out['selected_variant']))
    args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    return 0 if out['selected_variant'] else 2

if __name__=='__main__': raise SystemExit(main())
