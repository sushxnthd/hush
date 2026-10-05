#!/usr/bin/env python3
"""PiSAs development v1b: technical fix for task-family attribution.

No selector, configuration, metric, threshold, or task split changes from v1.
The original v1 run failed before producing any configuration scores because the
benchmark directory name (e.g. JIRA_allocation) is not always identical to the
scenario's internal task.type. This wrapper preserves the preregistered task-family
name on the public projection so subgroup aggregation is well-defined.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0,str(Path(__file__).resolve().parent))
import pisas_context_dev_v1 as base


def load_dev(root:Path):
    scenarios=[];gold_paths={};task_counts={}
    for task in base.DEV_TASKS:
        task_dir=root/task
        if not task_dir.is_dir():raise RuntimeError(f"Missing PiSAs development task {task}")
        count=0
        for folder in sorted(x for x in task_dir.iterdir() if x.is_dir() and (x/"scenario.json").exists()):
            scenario=json.loads((folder/"scenario.json").read_text(encoding="utf-8"))
            public=base.public_projection(scenario)
            public["_benchmark_task"]=task
            sid=public["scenario_id"]
            if not sid:raise RuntimeError(f"Missing scenario id in {folder}")
            scenarios.append(public);gold_paths[sid]=folder;count+=1
        task_counts[task]=count
    return scenarios,gold_paths,task_counts


def evaluate(scenarios:list[dict[str,Any]],models,gold_paths,cfg):
    selected={}
    for scenario in scenarios:
        sid=scenario["scenario_id"];m=models[sid];executor=m["executor"]
        selected[sid]={
            "raw_context":list(m["candidates"]),
            "semantic_only":base.choose_semantic(m,cfg),
            "executor_acl_only":base.choose_acl(m,cfg,executor),
            "hush_ci":base.choose_hush(m,cfg,executor),
        }
    rows=[]
    for scenario in scenarios:
        sid=scenario["scenario_id"];executor=models[sid]["executor"]
        gold=base.load_gold(gold_paths[sid]);task=str(scenario["_benchmark_task"])
        for arm,releases in selected[sid].items():
            rows.append({"scenario_id":sid,"task":task,"arm":arm,**base.score(releases,gold,executor)})
    return rows

base.load_dev=load_dev
base.evaluate=evaluate

if __name__=="__main__":
    raise SystemExit(base.main())
