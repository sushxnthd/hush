#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RESULT=ROOT/"research/pcc-runtime-product/choose_work_observable_result.json"
SOURCE=ROOT/"src/private-decision.js"
OUT=ROOT/"research/pcc-runtime-product/choose_work_observable_audit.json"

data=json.loads(RESULT.read_text())
source=SOURCE.read_text()
rows=data["rows"]
def canonical(value):
    return json.dumps(value,sort_keys=True,indent=2,separators=(",",": "),ensure_ascii=False)+"\n"

raw=dict(data)
claimed=raw.pop("canonicalSha256")
checks={
    "classification_exact":data["classification"]=="EXACT_SYNTHETIC_SAME_RELEASE_DIFFERENT_WORK_COUNTEREXAMPLE",
    "all_100_budgets_present":[r["syntheticBudget"] for r in rows]==list(range(100)),
    "authorized_release_constant":{r["authorizedResult"] for r in rows}=={"c0"},
    "feasible_count_exact":all(r["feasibleCandidates"]==r["syntheticBudget"]+1 for r in rows),
    "constraint_work_fixed":all(r["predictedConstraintEvaluations"]==100 for r in rows),
    "preference_work_secret_dependent":all(r["predictedPreferenceEvaluations"]==r["syntheticBudget"]+1 for r in rows),
    "hundred_distinct_work_counts":len({r["predictedPreferenceEvaluations"] for r in rows})==100,
    "source_filters_by_private_constraint":"const feasible = compiled.candidates.filter(c => constraints.every(rule=>passesConstraint(c,profile,rule)));" in source,
    "source_scores_only_feasible":"const scored = feasible.map(candidate=>({" in source,
    "source_hash_bound":hashlib.sha256(SOURCE.read_bytes()).hexdigest()==data["sourceWitness"]["sourceSha256"],
    "canonical_hash_bound":hashlib.sha256(canonical(raw).encode()).hexdigest()==claimed,
    "scientific_gate_passes":data["scientificGate"]=="PASS_SECRET_DEPENDENT_WORK_CHANNEL_CONFIRMED",
}
payload={
    "protocol":"hush.choose-work-observable.audit.v1",
    "classification":"INDEPENDENT_EXACT_ENUMERATION_AND_SOURCE_AUDIT",
    "checks":checks,
    "passed":sum(checks.values()),
    "total":len(checks),
    "allPass":all(checks.values()),
    "resultSha256":hashlib.sha256(RESULT.read_bytes()).hexdigest(),
}
OUT.write_text(canonical(payload))
print(canonical(payload),end="")
raise SystemExit(0 if payload["allPass"] else 1)
