#!/usr/bin/env python3
"""Independent HUSH-072 sanitized runtime-trace verifier (no Node imports)."""
import argparse
import copy
import json
from pathlib import Path

EXPECTED_ORDER = ["provider_arrived", "client_abort", "durable_close", "provider_commit"]

def verify(doc):
    if doc.get("version") != 1 or not isinstance(doc.get("scenarios"), list):
        raise ValueError("invalid trace envelope")
    scenarios = doc["scenarios"]
    names = [x.get("scenario") for x in scenarios]
    if len(scenarios) != 4 or len(set(names)) != 4 or set(names) != {
        "aborted_0", "aborted_1", "approved_control", "unapproved"
    }:
        raise ValueError("missing/duplicated scenarios")
    for row in scenarios:
        name = row["scenario"]
        if name.startswith("aborted_"):
            if row.get("order") != EXPECTED_ORDER or row.get("effects") != 1:
                raise ValueError("abort/closure/commit ordering or effect count invalid")
            if not row.get("clientAborted") or row.get("clientCompleted") or not row.get("closed"):
                raise ValueError("cancellation or closure witness missing")
            if row.get("brokerDecision") != "deny" or row.get("resultDigestNull") is not True:
                raise ValueError("broker did not suppress late result")
        elif name == "approved_control":
            if row.get("effects") != 1 or row.get("brokerDecision") != "allow":
                raise ValueError("approved control invalid")
            if row.get("clientCompleted") is not True or row.get("closed") is not False:
                raise ValueError("approved client control invalid")
        else:
            if row.get("effects") != 0 or row.get("brokerDecision") != "ask":
                raise ValueError("unapproved control invalid")
            if row.get("clientCompleted") is not True:
                raise ValueError("unapproved client control invalid")
    return True

def negative_controls(doc):
    assert verify(doc)
    mutations = []
    d = copy.deepcopy(doc); d["scenarios"][0]["effects"] = 0; mutations.append(d)
    d = copy.deepcopy(doc); d["scenarios"][0]["order"][-1] = "durable_close"; mutations.append(d)
    d = copy.deepcopy(doc); d["scenarios"][1]["resultDigestNull"] = False; mutations.append(d)
    d = copy.deepcopy(doc); d["scenarios"][2]["brokerDecision"] = "deny"; mutations.append(d)
    d = copy.deepcopy(doc); d["scenarios"].append(copy.deepcopy(d["scenarios"][0])); mutations.append(d)
    for mutated in mutations:
        try:
            verify(mutated)
        except ValueError:
            continue
        raise AssertionError("independent replay accepted an adversarial mutation")
    return len(mutations)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--trace", required=True)
    args = parser.parse_args()
    doc = json.loads(Path(args.trace).read_text(encoding="utf-8"))
    verify(doc)
    print(json.dumps({"status":"PASS","scenarios":4,"negative_controls":negative_controls(doc),
                      "production":"BLOCKED"},sort_keys=True))
