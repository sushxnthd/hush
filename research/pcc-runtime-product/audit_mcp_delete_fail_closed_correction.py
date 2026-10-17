#!/usr/bin/env python3
"""Independent source-order audit of the MCP DELETE correction."""

import hashlib
import json
from pathlib import Path

source = Path("src/server.js").read_text(encoding="utf-8")
markers = {
    "delete_branch": "if(req.method==='DELETE')",
    "deny_receipt": "const r=receipt(audit,'deny'",
    "method_response": "res.writeHead(405,securityHeaders({'allow':'GET, POST'",
    "get_branch": "if(req.method==='GET')",
    # Match the dispatch call itself rather than its former local declaration;
    # GET now assigns inside a try block, while DELETE must still terminate first.
    "dispatch": "await fetchMcpUpstream(req,u,null)",
}
positions = {name: source.index(marker) for name, marker in markers.items()}
ordered = positions["delete_branch"] < positions["deny_receipt"] < positions["method_response"] < positions["get_branch"] < positions["dispatch"]
no_delete_dispatch = "if(req.method==='GET'||req.method==='DELETE')" not in source
result = {
    "protocol": "mcp-delete-fail-closed-static-audit-v1",
    "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
    "all_markers_found": all(value >= 0 for value in positions.values()),
    "deny_receipt_precedes_first_transport_dispatch": ordered,
    "combined_delete_dispatch_removed": no_delete_dispatch,
    "all_gates_pass": ordered and no_delete_dispatch,
    "positions": positions,
}
print(json.dumps(result, indent=2, sort_keys=True))
