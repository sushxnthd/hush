#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
result_path = root / "research/pcc-runtime-product/mcp_stream_lifecycle_result.json"
source_path = root / "src/server.js"
result = json.loads(result_path.read_text())
source = source_path.read_text()
get_start = source.index("if(req.method==='GET')")
get_end = source.index("if(req.method!=='POST')", get_start)
get_branch = source[get_start:get_end]
allow_index = get_branch.index("const outcome=receipt")
pipe_index = get_branch.index("return pipeMcpResponse")
pipe_start = source.index("async function pipeMcpResponse")
pipe_end = source.index("async function dispatchMcpPost", pipe_start)
pipe_body = source[pipe_start:pipe_end]
scenarios = {row["mode"]: row for row in result["scenarios"]}
checks = {
    "three_fixed_scenarios": set(scenarios) == {"clean_eof", "upstream_abort", "client_cancel"},
    "real_upstream_reached": all(len(row["upstreamArrival"]) == 1 for row in scenarios.values()),
    "predispatch_attempt_observed": all(row["upstreamArrival"][0]["receiptCount"] >= 1 for row in scenarios.values()),
    "abnormal_endings_observed": scenarios["upstream_abort"]["clientTerminal"] != "complete" and scenarios["client_cancel"]["clientTerminal"] == "cancelled",
    "no_lifecycle_terminal_receipt": all(not row["hasLifecycleTerminal"] for row in scenarios.values()),
    "receipt_projections_identical": result["receiptsIndistinguishable"] is True,
    "allow_written_before_pipeline": allow_index < pipe_index,
    "pipeline_has_no_receipt_append": "receipt(" not in pipe_body,
    "signed_chains_valid": all(row["terminalSnapshot"]["chainValid"] for row in scenarios.values()),
    "counterexample_gate": result["scientificGate"] == "FALSIFIED_TERMINAL_STREAM_CLOSURE",
}
audit = {
    "schema": "hush.mcp-stream-lifecycle-audit.v1",
    "checks": checks,
    "passed": sum(checks.values()),
    "total": len(checks),
    "status": "PASS" if all(checks.values()) else "FAIL",
}
(root / "research/pcc-runtime-product/mcp_stream_lifecycle_static_audit.json").write_text(
    json.dumps(audit, indent=2, sort_keys=True) + "\n"
)
print(json.dumps(audit, indent=2, sort_keys=True))
raise SystemExit(0 if audit["status"] == "PASS" else 1)
