#!/usr/bin/env python3
"""Independent HUSH-070 sanitized history verifier. No provider or broker imports."""
import json
import sys
from pathlib import Path

EXPECTED = {
    "naive_post_effect_crash": (1, 2),
    "guarded_post_effect_crash": (1, 1),
    "guarded_normal": (1, 1),
    "invalid_key": (0, 0),
}

def verify(lines):
    observed = {}
    for line in lines:
        row = json.loads(line)
        if type(row) is not dict or set(row) != {"case", "effects_after_first", "effects_after_retry"}:
            raise ValueError("unexpected history schema")
        case = row["case"]
        if case not in EXPECTED or case in observed:
            raise ValueError("unknown or duplicate case")
        a, b = row["effects_after_first"], row["effects_after_retry"]
        if type(a) is not int or type(b) is not int or (a,b) != EXPECTED[case]:
            raise ValueError("effect count violated for "+case)
        observed[case] = (a,b)
    if set(observed) != set(EXPECTED):
        raise ValueError("missing cases")
    return {"status":"PASS_SANITIZED_REPLAY","cases":len(observed),
            "provider_external_effects_verified":False,
            "real_provider_idempotency_verified":False,
            "release":"BLOCKED"}

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: python hush_070_independent_replay.py trace.ndjson")
    try:
        result = verify(Path(sys.argv[1]).read_text(encoding="utf-8").splitlines())
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        sys.exit("FAIL_CLOSED: "+str(exc))
    print(json.dumps(result, sort_keys=True))
