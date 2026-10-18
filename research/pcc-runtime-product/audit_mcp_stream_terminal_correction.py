#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESULT = ROOT / "research/pcc-runtime-product/mcp_stream_terminal_correction_result.json"
SERVER = ROOT / "src/server.js"
OUT = ROOT / "research/pcc-runtime-product/mcp_stream_terminal_correction_audit.json"

data = json.loads(RESULT.read_text())
source = SERVER.read_text()
scenarios = {item["mode"]: item for item in data["scenarios"]}

def terminal_rows(item):
    rows = item.get("projection", item.get("afterRestart", []))
    return [row for row in rows if row["phase"] == "terminal"]

checks = {
    "scientific_gate_passes": data["scientificGate"] == "PASS_EXACTLY_ONCE_TERMINAL_STREAM_MEDIATION",
    "five_frozen_scenarios_present": set(scenarios) == {"clean_eof", "upstream_abort", "client_cancel", "race_upstream_first", "process_crash"},
    "all_receipt_chains_valid": all(item["chainValid"] for item in scenarios.values()),
    "all_upstream_arrivals_have_prior_attempt": all(len(item["arrivals"]) == 1 and item["arrivals"][0]["priorAttempts"] == 1 and item["arrivals"][0]["chainValid"] for item in scenarios.values()),
    "brokered_auth_used_without_persistence": all(item["arrivals"][0]["authorizationBrokered"] and not item["rawCredentialPersisted"] for item in scenarios.values()),
    "each_stream_has_exactly_one_terminal": all(len(terminal_rows(item)) == 1 for item in scenarios.values()),
    "three_primary_endings_distinguished": [terminal_rows(scenarios[name])[0]["streamTerminal"] for name in ("clean_eof", "upstream_abort", "client_cancel")] == ["complete", "error", "cancelled"],
    "upstream_first_race_is_error": terminal_rows(scenarios["race_upstream_first"])[0]["streamTerminal"] == "error",
    "crash_was_open_before_restart": not any(row["phase"] == "terminal" for row in scenarios["process_crash"]["beforeRestart"]),
    "crash_reconciles_once_to_error": terminal_rows(scenarios["process_crash"])[0]["streamTerminal"] == "error" and terminal_rows(scenarios["process_crash"])[0]["reconciled"] and terminal_rows(scenarios["process_crash"])[0]["terminalReason"] == "process_restart",
    "second_restart_is_idempotent": scenarios["process_crash"]["afterRestart"] == scenarios["process_crash"]["afterSecondRestart"],
    "attempt_precedes_dispatch_in_source": source.index("streamState:'attempted'") < source.index("upstream=await fetchMcpUpstream(req,u,null)"),
    "terminal_append_is_guarded": "if(existing)return existing" in source and "item.result?.phase==='terminal'" in source,
    "causal_race_classifier_present": "if(!firstFailure)firstFailure='upstream'" in source and "if(!res.writableEnded&&!firstFailure)firstFailure='client'" in source,
    "startup_reconciliation_present": "reconcileMcpStreams();" in source and "terminalReason:'process_restart'" in source,
}

payload = {
    "protocol": "hush.mcp-stream-terminal-correction.audit.v1",
    "classification": "INDEPENDENT_RESULT_AND_SOURCE_ORDER_AUDIT",
    "checks": checks,
    "passed": sum(checks.values()),
    "total": len(checks),
    "allPass": all(checks.values()),
    "resultSha256": hashlib.sha256(RESULT.read_bytes()).hexdigest(),
}
OUT.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n")
print(json.dumps(payload, indent=2, sort_keys=True))
raise SystemExit(0 if payload["allPass"] else 1)
