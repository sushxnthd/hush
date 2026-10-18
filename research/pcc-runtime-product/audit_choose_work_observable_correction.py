#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RESULT=ROOT/"research/pcc-runtime-product/choose_work_observable_correction_result.json"
OLD_RESULT=ROOT/"research/pcc-runtime-product/choose_work_observable_result.json"
SOURCE=ROOT/"src/private-decision.js"
OUT=ROOT/"research/pcc-runtime-product/choose_work_observable_correction_audit.json"
EXPECTED_OLD_CANONICAL_SHA="fba6712ed601aaa7ee3fd20f13eda9d188d40ca9e50d695af30c4e855816764c"

data=json.loads(RESULT.read_text())
old=json.loads(OLD_RESULT.read_text())
source=SOURCE.read_text()
rows=data["rows"]
def canonical(value):
    return json.dumps(value,sort_keys=True,indent=2,separators=(",",": "),ensure_ascii=False)+"\n"

raw=dict(data)
claimed=raw.pop("canonicalSha256")
checks={
    "classification_exact":data["classification"]=="EXACT_SYNTHETIC_PUBLIC_CARDINALITY_HIGH_LEVEL_WORK_CLOSURE",
    "all_100_budgets_present":[r["syntheticBudget"] for r in rows]==list(range(100)),
    "authorized_release_constant":{r["authorizedResult"] for r in rows}=={"c0"},
    "feasible_count_exact":all(r["feasibleCandidates"]==r["syntheticBudget"]+1 for r in rows),
    "constraint_work_public_cardinality":{r["sourceDerivedConstraintEvaluations"] for r in rows}=={100},
    "preference_work_public_cardinality":{r["sourceDerivedPreferenceEvaluations"] for r in rows}=={100},
    "source_visits_all_candidates":"for (const candidate of compiled.candidates) {" in source,
    "source_maps_all_constraints":"const constraintResults = constraints.map(rule=>passesConstraint(candidate,profile,rule));" in source,
    "source_maps_all_preferences":"const preferenceScores = preferences.map(pref=>preferenceScore(candidate,profile,pref));" in source,
    "source_removes_feasible_only_scoring":"const scored = feasible.map(candidate=>({" not in source,
    "source_hash_bound":hashlib.sha256(SOURCE.read_bytes()).hexdigest()==data["sourceWitness"]["sourceSha256"],
    "canonical_hash_bound":hashlib.sha256(canonical(raw).encode()).hexdigest()==claimed,
    "old_counterexample_preserved":old["canonicalSha256"]==EXPECTED_OLD_CANONICAL_SHA and old["distinctPreferenceWorkCounts"]==100,
    "scientific_gate_passes":data["scientificGate"]=="PASS_PUBLIC_CARDINALITY_HIGH_LEVEL_WORK_CLOSURE",
    "constant_time_not_claimed":"not a constant-time JavaScript claim" in data["smallestClaim"],
}
payload={
    "protocol":"hush.choose-work-observable-correction.audit.v1",
    "classification":"INDEPENDENT_EXACT_CORRECTION_AND_PROVENANCE_AUDIT",
    "checks":checks,
    "passed":sum(checks.values()),
    "total":len(checks),
    "allPass":all(checks.values()),
    "resultSha256":hashlib.sha256(RESULT.read_bytes()).hexdigest(),
    "preservedCounterexampleResultSha256":hashlib.sha256(OLD_RESULT.read_bytes()).hexdigest(),
}
OUT.write_text(canonical(payload))
print(canonical(payload),end="")
raise SystemExit(0 if payload["allPass"] else 1)
