#!/usr/bin/env python3
"""Independent closed-form audit of saved tightness cases."""

import argparse
import hashlib
import json
import math
from fractions import Fraction


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("result")
    args = ap.parse_args()
    doc = json.load(open(args.result, encoding="utf-8"))
    failures = 0
    last = {}
    rows = []
    for row in doc["cases"]:
        R, N = row["R"], row["N"]
        expected = Fraction(R**3 * (N + 1), N + R**2)
        observed = Fraction(row["gap_ratio"])
        gamma = math.log(float(expected), R)
        failures += int(observed != expected)
        failures += int(abs(gamma - row["gamma"]) > 1e-12)
        failures += int((gamma > 2) != (N > R))
        failures += int(gamma >= 3)
        if R in last:
            failures += int(gamma <= last[R])
        last[R] = gamma
        rows.append((R, N, str(expected), round(gamma, 15)))
    digest = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()
    out = {"case_count": len(rows), "failures": failures, "rows_sha256": digest, "source_canonical_sha256": doc["canonical_payload_sha256"], "status": "PASS" if failures == 0 else "FAIL"}
    print(json.dumps(out, sort_keys=True, indent=2))


if __name__ == "__main__":
    main()
