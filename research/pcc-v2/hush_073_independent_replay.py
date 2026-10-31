#!/usr/bin/env python3
"""HUSH-073: independent stdlib-only replay of sanitized real-broker status traces.

Checks output-channel noninterference, not provider effects, timing, or network
privacy. Never consumes raw provider responses or credentials.
"""
from __future__ import annotations
import argparse
import copy
import json
from pathlib import Path

NAMES = {"closed_0", "closed_1", "open_0", "open_1", "unapproved_1"}
FIELDS = {"name", "decision", "receiptStatus", "digestNull",
          "hasResult", "requests", "closed"}

class ReplayFailure(ValueError):
    pass

def check(data):
    if not isinstance(data, dict) or set(data) != {"schema", "expectedLeak", "scenarios"}:
        raise ReplayFailure("invalid top-level trace")
    if data["schema"] != "hush-073-trace-v1" or type(data["expectedLeak"]) is not bool:
        raise ReplayFailure("invalid schema/mode")
    if not isinstance(data["scenarios"], list) or len(data["scenarios"]) != 5:
        raise ReplayFailure("wrong number of scenarios")
    by_name = {}
    for row in data["scenarios"]:
        if not isinstance(row, dict) or set(row) != FIELDS:
            raise ReplayFailure("unexpected trace fields")
        name = row["name"]
        if name not in NAMES or name in by_name:
            raise ReplayFailure("missing/duplicate/unknown scenario")
        if type(row["requests"]) is not int or row["requests"] not in (0, 1):
            raise ReplayFailure("invalid provider request count")
        if any(type(row[k]) is not bool for k in ("digestNull", "hasResult", "closed")):
            raise ReplayFailure("invalid boolean")
        if row["decision"] not in ("deny", "error", "allow", "ask"):
            raise ReplayFailure("invalid decision")
        if row["receiptStatus"] not in ("deny", "error", "allow", None):
            raise ReplayFailure("invalid receipt status")
        by_name[name] = row
    if set(by_name) != NAMES:
        raise ReplayFailure("scenario set mismatch")
    for name in ("closed_0", "closed_1"):
        x = by_name[name]
        if x["requests"] != 1 or not x["closed"] or not x["digestNull"] or x["hasResult"]:
            raise ReplayFailure("closed-world physical/receipt invariant violated")
    a, b = by_name["closed_0"], by_name["closed_1"]
    if (a["decision"], a["receiptStatus"]) != ("deny", "deny"):
        raise ReplayFailure("closed success not denied")
    if data["expectedLeak"]:
        if (b["decision"], b["receiptStatus"]) != ("error", "error"):
            raise ReplayFailure("prepatch counterexample not reproduced")
    else:
        if (b["decision"], b["receiptStatus"]) != ("deny", "deny"):
            raise ReplayFailure("private-dependent post-close status leak")
    for name,decision,receipt,has_result in (
        ("open_0","allow","allow",True),
        ("open_1","error","error",False),
        ("unapproved_1","ask",None,False),
    ):
        x=by_name[name]
        if (x["decision"],x["receiptStatus"],x["hasResult"]) != (decision,receipt,has_result):
            raise ReplayFailure("control result mismatch")
        if x["closed"] or x["requests"] != (0 if name=="unapproved_1" else 1):
            raise ReplayFailure("control dispatch invariant violated")
    return {"schema":"hush-073-independent-replay-v1",
            "status":"PASS", "mode":"PREPATCH_LEAK" if data["expectedLeak"] else "PATCHED_CLOSURE",
            "scenarios":5, "production":"BLOCKED"}

def self_test():
    rows = [
        ("closed_0","deny","deny",True,False,1,True),
        ("closed_1","deny","deny",True,False,1,True),
        ("open_0","allow","allow",False,True,1,False),
        ("open_1","error","error",True,False,1,False),
        ("unapproved_1","ask",None,True,False,0,False),
    ]
    data={"schema":"hush-073-trace-v1","expectedLeak":False,
          "scenarios":[dict(zip(("name","decision","receiptStatus","digestNull",
                                 "hasResult","requests","closed"),row)) for row in rows]}
    check(data)
    mutations=[
        lambda d:d["scenarios"][1].update(decision="error"),
        lambda d:d["scenarios"][1].update(receiptStatus="error"),
        lambda d:d["scenarios"][1].update(digestNull=False),
        lambda d:d["scenarios"][1].update(requests=0),
        lambda d:d["scenarios"][2].update(decision="deny"),
        lambda d:d["scenarios"][4].update(requests=1),
        lambda d:d["scenarios"][1].update(name="closed_0"),
    ]
    for mutation in mutations:
        altered=copy.deepcopy(data)
        mutation(altered)
        try: check(altered)
        except ReplayFailure: continue
        raise AssertionError("tampered trace accepted")
    return {"status":"PASS","negative_controls":len(mutations)}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("trace",type=Path,nargs="?")
    p.add_argument("--self-test",action="store_true")
    args=p.parse_args()
    try:
        if args.self_test:
            result=self_test()
        else:
            if args.trace is None: p.error("trace path required")
            result=check(json.loads(args.trace.read_text(encoding="utf-8")))
    except (ReplayFailure,ValueError,OSError) as exc:
        p.exit(2,"HUSH-073 FAIL_CLOSED: "+str(exc)+"\n")
    print(json.dumps(result,sort_keys=True))

if __name__=="__main__":
    main()
