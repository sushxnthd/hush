#!/usr/bin/env python3
"""AgentLeak context-boundary development v1b.

v1's privacy reduction was strong but utility suffered because a negative cue anywhere
in the privacy instruction could suppress a field mentioned in a separate positive
clause. v1b preserves the frozen dev/holdout split and changes only development-time
selection:

- scope negative privacy terms to their sentence/clause;
- treat "other <entity>" restrictions as non-target restrictions;
- use positive privacy clauses ("include/show/only confirm") as relevance hints;
- use AgentLeak's documented primary-target convention (record 0) only as a local
  fallback when the user request itself does not identify a record.

Gold allowed_set/evaluation fields remain scorer-only inside the imported v1 evaluator.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import agentleak_context_boundary_v1 as base

CONFIGS = (
    {"id":"v1b_f4_t050_r080","max_fields":4,"threshold":0.50,"risk_penalty":0.80},
    {"id":"v1b_f6_t045_r075","max_fields":6,"threshold":0.45,"risk_penalty":0.75},
    {"id":"v1b_f8_t040_r070","max_fields":8,"threshold":0.40,"risk_penalty":0.70},
    {"id":"v1b_f10_t035_r065","max_fields":10,"threshold":0.35,"risk_penalty":0.65},
    {"id":"v1b_f12_t030_r060","max_fields":12,"threshold":0.30,"risk_penalty":0.60},
)

POSITIVE_CUES=("include", "show", "confirm", "provide", "use", "only confirm", "only include", "only show")
OTHER_CUES=("other", "another", "unrelated", "different")

PRIVACY_ALIASES={
    "name":{"name","patient name","client name","employee name","customer name"},
    "patient_name":{"patient name","name"},
    "client_name":{"client name","name"},
    "employee_name":{"employee name","name"},
    "customer_name":{"customer name","name"},
    "account_last4":{"last 4","last four","last 4 digits","last four digits","account last 4"},
    "ssn":{"ssn","social security","social security number"},
    "diagnosis":{"diagnosis","diagnoses","medical condition"},
    "allergies":{"allergy","allergies"},
    "medications":{"medication","medications","drug list"},
    "confidential_notes":{"confidential notes","private notes","psychiatric notes"},
    "psychiatric_notes":{"psychiatric notes","mental health notes"},
    "case_id":{"case id","case number"},
    "status":{"status","case status"},
    "address":{"address","home address"},
    "phone":{"phone","phone number"},
    "email":{"email","email address"},
    "insurance_id":{"insurance id","insurance number"},
    "bank_account":{"bank account","account number"},
    "account_number":{"account number","full account number"},
    "credit_card":{"credit card","card number"},
}


def clauses(instruction:str)->list[str]:
    return [base.norm(x) for x in re.split(r"[.;\n]+", str(instruction or "")) if base.norm(x)]


def privacy_aliases(field:str)->set[str]:
    key=base.field_key(field)
    return {base.norm(x) for x in PRIVACY_ALIASES.get(key, base.aliases(field)) if base.norm(x)}


def negative_clause(clause:str)->bool:
    return any(cue in clause for cue in base.NEGATIVE_CUES)


def scoped_privacy_block(field:str,instruction:str,is_target:bool=False)->bool:
    field_aliases=privacy_aliases(field)
    for clause in clauses(instruction):
        if not negative_clause(clause):
            continue
        if not any(alias in clause for alias in field_aliases):
            continue
        # "Do not reveal other client names" restricts non-target records; it
        # should not erase the task's primary client identity.
        if is_target and any(re.search(rf"\b{re.escape(cue)}\b",clause) for cue in OTHER_CUES):
            continue
        return True
    return False


def positive_privacy_bonus(field:str,instruction:str)->float:
    field_aliases=privacy_aliases(field)
    best=0.0
    for clause in clauses(instruction):
        if negative_clause(clause):
            continue
        if not any(cue in clause for cue in POSITIVE_CUES):
            continue
        if any(alias in clause for alias in field_aliases):
            best=max(best,1.50)
    return best


def positive_instruction_text(instruction:str)->str:
    return " ".join(clause for clause in clauses(instruction) if not negative_clause(clause))


def select_fields_v1b(scenario:dict,config:dict)->list[base.FieldCandidate]:
    cands=base.flatten(scenario)
    query=base.objective_text(scenario)
    instruction=base.privacy_text(scenario)
    positive=positive_instruction_text(instruction)
    relevance_text=(query+" "+positive).strip()
    qn,qt=base.norm(query),base.tokens(relevance_text)
    rscores=base.record_relevance(cands,query)
    ranked_record=max(rscores,key=rscores.get) if rscores else None
    ranked_score=rscores.get(ranked_record,0.0) if ranked_record is not None else 0.0
    # AgentLeak's own runner defines the primary target from record 0. We use that
    # only when the natural-language request does not itself identify a record.
    target_record=ranked_record if ranked_record is not None and ranked_score>=2.0 else (0 if cands else None)

    ranked=[]
    for c in cands:
        is_target=c.record_index==target_record
        if scoped_privacy_block(c.field,instruction,is_target=is_target):
            continue
        value=base.norm(base.scalar_text(c.value))
        exact_value=1.0 if 3<=len(value)<=120 and value in qn else 0.0
        field_aliases=base.aliases(c.field)
        ft=set().union(*(base.tokens(a) for a in field_aliases)) if field_aliases else base.tokens(c.field)
        lexical=len(ft & qt)/max(1,len(ft)) if ft else 0.0
        pbonus=positive_privacy_bonus(c.field,instruction)
        relevance=3.0*exact_value+1.2*lexical+base.task_bonus(c.field,relevance_text)+pbonus

        if target_record is not None:
            relevance += 0.90 if is_target else -2.00
        if base.field_key(c.field) in {"name","patient_name","client_name","employee_name","customer_name"} and is_target:
            relevance += 0.55

        effective_risk=base.risk(c.field)*(0.30 if pbonus>0 else 1.0)
        final=relevance-config["risk_penalty"]*effective_risk
        if final>=config["threshold"]:
            ranked.append((final,relevance,-effective_risk,c))

    ranked.sort(key=lambda row:(-row[0],-row[1],-row[2],row[3].record_index,base.field_key(row[3].field)))
    return [row[3] for row in ranked[:config["max_fields"]]]


base.CONFIGS=CONFIGS
base.select_fields=select_fields_v1b

if __name__=='__main__':
    raise SystemExit(base.main())
