#!/usr/bin/env python3
"""AgentLeak context-boundary development v1d.

v1c made exclusive privacy clauses hard allowlists and crossed the privacy bar, but
lost utility because some task-required fields are stated in the objective/success
criteria rather than repeated in the privacy clause. v1d keeps the hard policy while
also preserving fields that are independently required by the user-visible objective.

No AgentLeak gold labels, canaries, field weights, or attack payload are used by the
selector. The deterministic holdout remains untouched.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentleak_context_boundary_v1 as base
import agentleak_context_boundary_v1b as v1b
import agentleak_context_boundary_v1c as v1c

CONFIGS = (
    {"id":"v1d_f4_t050_r080","max_fields":4,"threshold":0.50,"risk_penalty":0.80},
    {"id":"v1d_f6_t045_r075","max_fields":6,"threshold":0.45,"risk_penalty":0.75},
    {"id":"v1d_f8_t040_r070","max_fields":8,"threshold":0.40,"risk_penalty":0.70},
    {"id":"v1d_f10_t035_r065","max_fields":10,"threshold":0.35,"risk_penalty":0.65},
)


def objective_requires(field:str,scenario:dict)->bool:
    objective=base.objective_text(scenario)
    q=base.norm(objective)
    aliases=base.aliases(field)
    if any(alias and alias in q for alias in aliases):
        return True
    # Reuse the same generic intent-to-field map that existed before AgentLeak was
    # integrated. A positive task-role match is independent evidence of necessity.
    return base.task_bonus(field,objective)>=1.0


def select_fields_v1d(scenario:dict,config:dict)->list[base.FieldCandidate]:
    selected=v1b.select_fields_v1b(scenario,config)
    exclusive=v1c.exclusive_positive_clauses(base.privacy_text(scenario))
    if not exclusive:
        return selected

    filtered=[]
    for candidate in selected:
        if candidate.record_index!=0:
            continue
        if (
            v1c.mentioned_by_policy(candidate.field,exclusive)
            or v1c.objective_anchor(candidate,scenario)
            or objective_requires(candidate.field,scenario)
        ):
            filtered.append(candidate)
    return filtered


base.CONFIGS=CONFIGS
base.select_fields=select_fields_v1d

if __name__=='__main__':
    raise SystemExit(base.main())
