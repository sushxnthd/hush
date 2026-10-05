#!/usr/bin/env python3
"""AgentLeak context-boundary development v1c.

v1b restored task-context utility but still released too many fields when the user's
privacy instruction expressed an exclusive positive policy such as "include X only"
or "only confirm Y". v1c interprets those clauses as an allowlist instead of merely
as a relevance bonus.

The allowlist is derived exclusively from user-visible task/policy text and local
record metadata/values. AgentLeak gold allowed_set, canaries and field weights remain
scorer-only in the imported evaluator. The deterministic holdout remains untouched.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentleak_context_boundary_v1 as base
import agentleak_context_boundary_v1b as v1b

CONFIGS = (
    {"id":"v1c_f4_t050_r080","max_fields":4,"threshold":0.50,"risk_penalty":0.80},
    {"id":"v1c_f6_t045_r075","max_fields":6,"threshold":0.45,"risk_penalty":0.75},
    {"id":"v1c_f8_t040_r070","max_fields":8,"threshold":0.40,"risk_penalty":0.70},
    {"id":"v1c_f10_t035_r065","max_fields":10,"threshold":0.35,"risk_penalty":0.65},
)

EXCLUSIVE_PATTERNS=(
    re.compile(r"\bonly\s+(?:include|show|confirm|provide|use|share|return|report)\b"),
    re.compile(r"\b(?:include|show|confirm|provide|use|share|return|report)\b.*\bonly\b"),
    re.compile(r"\blimit\b.*\bto\b"),
    re.compile(r"\brestrict\b.*\bto\b"),
)

IDENTITY_FIELDS={
    'name','patient_name','client_name','employee_name','customer_name','case_id',
    'invoice_id','transaction_id','dispute_id','account_last4','record_id','ticket_id',
}


def exclusive_positive_clauses(instruction:str)->list[str]:
    out=[]
    for clause in v1b.clauses(instruction):
        if v1b.negative_clause(clause):
            continue
        if any(pattern.search(clause) for pattern in EXCLUSIVE_PATTERNS):
            out.append(clause)
    return out


def mentioned_by_policy(field:str,exclusive:list[str])->bool:
    aliases=v1b.privacy_aliases(field)
    return any(any(alias in clause for alias in aliases) for clause in exclusive)


def objective_anchor(candidate:base.FieldCandidate,scenario:dict)->bool:
    query=base.norm(base.objective_text(scenario))
    value=base.norm(base.scalar_text(candidate.value))
    if 3<=len(value)<=120 and value in query:
        return True
    key=base.field_key(candidate.field)
    if key not in IDENTITY_FIELDS:
        return False
    aliases=base.aliases(candidate.field)
    return any(alias and alias in query for alias in aliases)


def select_fields_v1c(scenario:dict,config:dict)->list[base.FieldCandidate]:
    selected=v1b.select_fields_v1b(scenario,config)
    exclusive=exclusive_positive_clauses(base.privacy_text(scenario))
    if not exclusive:
        return selected

    # AgentLeak's primary-task record is record 0. Preserve an explicit objective
    # anchor (for example a case ID or patient name) even when an exclusive policy
    # names only the payload field; every other field must be positively permitted.
    filtered=[]
    for candidate in selected:
        if candidate.record_index!=0:
            continue
        if mentioned_by_policy(candidate.field,exclusive) or objective_anchor(candidate,scenario):
            filtered.append(candidate)
    return filtered


base.CONFIGS=CONFIGS
base.select_fields=select_fields_v1c

if __name__=='__main__':
    raise SystemExit(base.main())
