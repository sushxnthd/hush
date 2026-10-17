#!/usr/bin/env python3
"""Independent source-order audit of the MCP GET correction."""
import json
from pathlib import Path

source = Path("src/server.js").read_text(encoding="utf-8")
mcp_start = source.index("async function mcp(")
get_start = source.index("if(req.method==='GET')", mcp_start)
get_end = source.index("  if(req.method!=='POST')", get_start)
get_branch = source[get_start:get_end]
markers = {
    "attempt_receipt": "receipt(audit,'approved'",
    "dispatch": "upstream=await fetchMcpUpstream(req,u,null)",
    "error_receipt": "receipt(audit,'error'",
    "outcome_receipt": "const outcome=receipt(audit,upstream.ok?'allow':'error'",
    "bound_response": "'x-hush-receipt-hash':outcome.hash",
}
positions = {name: get_branch.index(marker) for name, marker in markers.items()}
ordered = positions["attempt_receipt"] < positions["dispatch"] < positions["outcome_receipt"] < positions["bound_response"]
error_closes = positions["dispatch"] < positions["error_receipt"] < positions["outcome_receipt"]
result = {
    "protocol": "mcp-get-fail-closed-correction-static-audit-v2-scoped",
    "scope": "mcp GET branch",
    "positions": positions,
    "attempt_precedes_dispatch": ordered,
    "failure_path_has_error_outcome": error_closes,
    "response_bound_to_outcome": positions["bound_response"] > positions["outcome_receipt"],
    "all_gates_pass": ordered and error_closes,
}
print(json.dumps(result, indent=2, sort_keys=True))
