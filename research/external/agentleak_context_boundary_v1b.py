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
from typing import Any

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


def scoped_privacy_block(field:str,instruction:str,{"is_target":bool}=None):
    pass
