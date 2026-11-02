#!/usr/bin/env python3
"""HUSH-067 independent trace-order replay (research only, no provider attestation)."""
import json
import sys
from pathlib import Path

EXPECTED = {
    "abort_after_receipt": [
        "provider_received", "client_aborted", "broker_error",
        "durable_closed", "provider_committed",
    ],
    "kill_after_receipt": [
        "provider_received", "child_killed", "restart_denied",
        "revocation_locked", "provider_committed",
    ],
}

def replay(path):
    rows = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    seen = set()
    assert len(rows) == 4, f"expected 4 event histories, got {len(rows)}"
    for row in rows:
        name, world = row["case"], row["world"]
        assert name in EXPECTED and world in {"zero", "one"}
        assert (name, world) not in seen, "duplicate history"
        seen.add((name, world))
        assert row["events"] == EXPECTED[name], f"unexpected order in {name}/{world}"
        assert row["details"]["commits"] == 1
        if name == "abort_after_receipt":
            assert row["details"]["brokerDecision"] == "error"
            assert row["details"]["closed"] is True
        else:
            assert row["details"]["restartDecision"] == "deny"
            assert row["details"]["revocation"] == "LOCKED"
        assert "HUSH067_CREDENTIAL_" not in json.dumps(row), "trace exposed credential"
    assert seen == {(name, world) for name in EXPECTED for world in ("zero", "one")}
    print("HUSH-067 independent event-order replay: 4/4 histories verified")
    print("LIMIT: provider commit is a deliberately controlled loopback fixture, not a remote-provider attestation.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 e067_replay.py TRACE.ndjson")
    replay(sys.argv[1])
