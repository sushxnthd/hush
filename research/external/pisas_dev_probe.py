#!/usr/bin/env python3
"""Emit a tiny development-only PiSAs schema sample for evaluator debugging.

The confirmatory task allowlist is explicitly rejected. This file exists only to
understand why a deterministic development scorer can under-count raw-context
coverage; it is not used by the candidate selector.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path

DEV=("uas_flight_readiness","JIRA_allocation","meeting_allocation","severity_classification")
RESERVED={"inpatient_discharge","thesis_readiness","manuscript_submission","outgoing_museum_loan","special_event_permit_readiness"}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--dataset-root',type=Path,required=True);ap.add_argument('--output',type=Path,required=True);args=ap.parse_args()
    out={}
    for task in DEV:
        assert task not in RESERVED
        folders=sorted(x for x in (args.dataset_root/task).iterdir() if x.is_dir() and (x/'scenario.json').exists())
        folder=folders[0]
        scenario=json.loads((folder/'scenario.json').read_text())
        utility=json.loads((folder/'utility.json').read_text())
        appr=json.loads((folder/'appropriateness.json').read_text())
        vis=json.loads((folder/'visibility.json').read_text())
        appropriate=[a for a,v in appr.get('attributes',{}).items() if v=='appropriate']
        inappropriate=[a for a,v in appr.get('attributes',{}).items() if v=='inappropriate']
        vals=utility.get('attribute_values',{})
        out[task]={
          'scenario_id':scenario.get('scenario_id'),
          'task':scenario.get('task'),
          'timeline':[{'id':x.get('id'),'type':x.get('type'),'author':x.get('author'),'visible_to':x.get('visible_to'),'source_type':x.get('source_type'),'content':x.get('content'),'attributes':x.get('attributes')} for x in scenario.get('timeline',[])],
          'appropriate':{a:vals.get(a) for a in appropriate},
          'inappropriate_sample':{a:vals.get(a) for a in inappropriate[:3]},
          'visibility_sample':{a:vis.get('attributes',{}).get(a) for a in (appropriate+inappropriate[:3])},
        }
    args.output.write_text(json.dumps(out,indent=2,sort_keys=True)+'\n')

if __name__=='__main__':main()
