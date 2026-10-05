#!/usr/bin/env python3
"""Final local development sweep around the v1c frontier.

This is still development-only. It tests whether a gentler contextual-risk gate can
recover the small task-ambiguity completeness deficit while retaining a paired
privacy advantage. The reserved e2e holdout is used only as an ID exclusion list.
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

base.DENSE_TOP_N=48
base.atomic_spans=atom.atomic_minimal

CONFIGS=(
 {"id":"f32_r45_g50","max_spans":32,"risk_penalty":0.45,"gate":0.50},
 {"id":"f32_r50_g55","max_spans":32,"risk_penalty":0.50,"gate":0.55},
 {"id":"f32_r55_g60","max_spans":32,"risk_penalty":0.55,"gate":0.60},
 {"id":"f36_r45_g50","max_spans":36,"risk_penalty":0.45,"gate":0.50},
 {"id":"f36_r50_g55","max_spans":36,"risk_penalty":0.50,"gate":0.55},
 {"id":"f36_r55_g60","max_spans":36,"risk_penalty":0.55,"gate":0.60},
 {"id":"f40_r45_g55","max_spans":40,"risk_penalty":0.45,"gate":0.55},
 {"id":"f40_r50_g60","max_spans":40,"risk_penalty":0.50,"gate":0.60},
)

def choose_semantic(row,cfg):
 c=row['candidates'];r=sorted(row['ranked'],key=lambda x:(-x['semantic'],base.norm(c[x['idx']].release)));return [c[x['idx']].release for x in r[:cfg['max_spans']]]

def choose_lexical(row,cfg):
 c=row['candidates'];r=sorted(row['ranked'],key=lambda x:(-x['lexical'],-x['semantic'],base.norm(c[x['idx']].release)));return [c[x['idx']].release for x in r[:cfg['max_spans']]]

def choose_hush(row,cfg):
 c=row['candidates'];rank=[]
 for r in row['ranked']:
  risk=atom.sensitivity(c[r['idx']]);override=r['override'];effective=risk*(1-override)
  if effective>=cfg['gate'] and override<0.60: continue
  rank.append({**r,'score':r['semantic']+0.12*r['lexical']-cfg['risk_penalty']*effective})
 rank.sort(key=lambda x:(-x['score'],-x['semantic'],base.norm(c[x['idx']].release)))
 return [c[x['idx']].release for x in rank[:cfg['max_spans']]]

def main()->int:
 ap=argparse.ArgumentParser();ap.add_argument('--dev-dir',type=Path,required=True);ap.add_argument('--holdout-dir',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path('agentcibench-dev-v1d.json'));args=ap.parse_args()
 scenarios=base.load_scenarios(args.dev_dir,args.holdout_dir,base.DEV_PER_MODE)
 models=base.run_models(scenarios);out={'status':'DEVELOPMENT_ONLY_V1D','scenarios':len(scenarios),'configs':{},'freeze_candidate':None}
 eligible=[]
 for cfg in CONFIGS:
  rows=[]
  for s in scenarios:
   sid=str(s['scenario_id']);m=models[sid];public=[str(s['task_prompt'])]
   arms={'semantic_only':public+choose_semantic(m,cfg),'lexical_minimization':public+choose_lexical(m,cfg),'hush_ci':public+choose_hush(m,cfg)}
   for arm,vals in arms.items(): rows.append({'scenario_id':sid,'failure_mode':str(s.get('failure_mode') or 'unknown'),'arm':arm,**base.score(vals,s['ground_truth'])})
  sums={a:base.aggregate(rows,a) for a in ('semantic_only','lexical_minimization','hush_ci')};pair=base.paired(rows,'hush_ci','semantic_only','leak_free')
  groups={};subgroup_ready=True
  for mode in sorted({r['failure_mode'] for r in rows}):
   mr=[r for r in rows if r['failure_mode']==mode];groups[mode]={a:base.aggregate(mr,a) for a in ('semantic_only','lexical_minimization','hush_ci')}
   h=groups[mode]['hush_ci'];s=groups[mode]['semantic_only']
   if h['n']>=10 and h['mean_completeness'] < s['mean_completeness']-0.05-1e-12: subgroup_ready=False
  h=sums['hush_ci'];s=sums['semantic_only'];l=sums['lexical_minimization']
  ready=(h['mean_completeness']>=0.90 and h['fully_useful_rate']>=0.75 and subgroup_ready and h['leak_free_rate']>s['leak_free_rate'] and h['mean_violation']<s['mean_violation'] and h['minimal_success_rate']>s['minimal_success_rate'] and h['minimal_success_rate']>l['minimal_success_rate'] and pair['left_only']>pair['right_only'] and pair['p_two_sided']<0.05)
  out['configs'][cfg['id']]={'config':cfg,'freeze_ready':ready,'summary':sums,'paired_leak_free_vs_semantic':pair,'subgroups':groups}
  print(f"{cfg['id']:14s} H comp={h['mean_completeness']:.3f} useful={h['fully_useful_rate']:.3f} leak={h['leak_free_rate']:.3f} success={h['minimal_success_rate']:.3f} viol={h['mean_violation']:.3f} S comp={s['mean_completeness']:.3f} leak={s['leak_free_rate']:.3f} success={s['minimal_success_rate']:.3f} L success={l['minimal_success_rate']:.3f} H/S={pair['left_only']}/{pair['right_only']} p={pair['p_two_sided']:.4g} subgroup={subgroup_ready} ready={ready}")
  if ready: eligible.append((h['minimal_success_rate'],h['leak_free_rate'],h['mean_completeness'],-h['mean_violation'],-h['mean_released_chars'],cfg['id']))
 eligible.sort(reverse=True);out['freeze_candidate']=eligible[0][-1] if eligible else None;print('freeze_candidate='+str(out['freeze_candidate']))
 args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n',encoding='utf-8');return 0 if out['freeze_candidate'] else 2
if __name__=='__main__': raise SystemExit(main())
