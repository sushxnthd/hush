#!/usr/bin/env python3
"""Development diagnostics for AgentLeak v1d error classes.

Uses scorer-only gold labels strictly after selection to identify which field classes
cause remaining utility misses and forbidden exposures. Never used on the holdout.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentleak_context_boundary_v1 as base
import agentleak_context_boundary_v1d as v1d

CONFIG_IDS=('v1d_f4_t050_r080','v1d_f6_t045_r075')


def analyze(scenarios, config):
    allowed_present=Counter(); allowed_missed=Counter(); forbidden_present=Counter(); forbidden_exposed=Counter()
    misses=defaultdict(list); leaks=defaultdict(list)
    for scenario in scenarios:
        selected=v1d.select_fields_v1d(scenario,config)
        selected_keys={(c.record_index,base.field_key(c.field)) for c in selected}
        all_fields=base.flatten(scenario)
        target=[c for c in all_fields if c.record_index==0]
        allowed=[str(x) for x in (scenario.get('allowed_set') or {}).get('fields',[])]
        forbidden=[str(x) for x in (scenario.get('allowed_set') or {}).get('forbidden_fields',[])]
        for c in target:
            if any(base.matches_label(c.field,label) for label in allowed):
                key=base.field_key(c.field); allowed_present[key]+=1
                if (c.record_index,key) not in selected_keys:
                    allowed_missed[key]+=1
                    if len(misses[key])<4:
                        misses[key].append({
                            'scenario_id':scenario.get('scenario_id'),'vertical':scenario.get('vertical'),'field':c.field,
                            'request':(scenario.get('objective') or {}).get('user_request'),
                            'success':(scenario.get('objective') or {}).get('success_criteria'),
                            'privacy':base.privacy_text(scenario),
                            'exclusive':v1d.v1c.exclusive_positive_clauses(base.privacy_text(scenario)),
                            'objective_requires':v1d.objective_requires(c.field,scenario),
                            'policy_mentions':v1d.v1c.mentioned_by_policy(c.field,v1d.v1c.exclusive_positive_clauses(base.privacy_text(scenario)))
                        })
        for c in all_fields:
            if any(base.matches_label(c.field,label) for label in forbidden):
                key=base.field_key(c.field); forbidden_present[key]+=1
                if (c.record_index,key) in selected_keys:
                    forbidden_exposed[key]+=1
                    if len(leaks[key])<4:
                        leaks[key].append({
                            'scenario_id':scenario.get('scenario_id'),'vertical':scenario.get('vertical'),'record_index':c.record_index,'field':c.field,
                            'request':(scenario.get('objective') or {}).get('user_request'),
                            'success':(scenario.get('objective') or {}).get('success_criteria'),
                            'privacy':base.privacy_text(scenario),
                            'exclusive':v1d.v1c.exclusive_positive_clauses(base.privacy_text(scenario)),
                            'objective_requires':v1d.objective_requires(c.field,scenario),
                            'value_anchor':v1d.v1c.objective_anchor(c,scenario),
                            'policy_mentions':v1d.v1c.mentioned_by_policy(c.field,v1d.v1c.exclusive_positive_clauses(base.privacy_text(scenario)))
                        })
    miss_rows=[{'field':k,'present':allowed_present[k],'missed':allowed_missed[k],'miss_rate':allowed_missed[k]/allowed_present[k],'examples':misses[k]} for k in allowed_present if allowed_missed[k]]
    leak_rows=[{'field':k,'present':forbidden_present[k],'exposed':forbidden_exposed[k],'exposure_rate':forbidden_exposed[k]/forbidden_present[k],'examples':leaks[k]} for k in forbidden_present if forbidden_exposed[k]]
    miss_rows.sort(key=lambda r:(-r['missed'],r['field'])); leak_rows.sort(key=lambda r:(-r['exposed'],r['field']))
    return {'config':config,'allowed_misses':miss_rows,'forbidden_exposures':leak_rows}


def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--dataset',type=Path,required=True); ap.add_argument('--output',type=Path,default=Path('agentleak-context-diag-v1d.json')); args=ap.parse_args()
    scenarios=base.load_jsonl(args.dataset,'dev')
    configs={c['id']:c for c in v1d.CONFIGS}
    result={'scenarios':len(scenarios),'configs':{cid:analyze(scenarios,configs[cid]) for cid in CONFIG_IDS}}
    args.output.write_text(json.dumps(result,indent=2,sort_keys=True)+'\n',encoding='utf-8')
    for cid in CONFIG_IDS:
        print('\n'+cid)
        print('Top allowed misses:')
        for row in result['configs'][cid]['allowed_misses'][:20]: print(f"  {row['field']:24s} missed={row['missed']:3d}/{row['present']:3d} rate={row['miss_rate']:.3f}")
        print('Top forbidden exposures:')
        for row in result['configs'][cid]['forbidden_exposures'][:20]: print(f"  {row['field']:24s} exposed={row['exposed']:3d}/{row['present']:3d} rate={row['exposure_rate']:.3f}")
    return 0

if __name__=='__main__': raise SystemExit(main())
