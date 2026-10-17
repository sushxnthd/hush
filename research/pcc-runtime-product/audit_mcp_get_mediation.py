#!/usr/bin/env python3
"""Independent source-order audit for authenticated MCP GET dispatch."""

import hashlib
import json
from pathlib import Path

source = Path("src/server.js").read_text(encoding="utf-8")
markers = {
    "get_branch": "if(req.method==='GET')",
    "configured_guard": "if(!mcpUpstream){res.writeHead(405",
    "dispatch": "const upstream=await fetchMcpUpstream(req,u,null);",
    "pipe_response": "return pipeMcpResponse(res,upstream);",
}
positions = {name: source.index(marker) for name, marker in markers.items()}
branch = source[positions["get_branch"] : positions["pipe_response"] + len(markers["pipe_response"])]
ordered = positions["get_branch"] < positions["configured_guard"] < positions["dispatch"] < positions["pipe_response"]
result = {
    "protocol": "mcp-get-complete-mediation-static-audit-v1",
    "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
    "all_markers_found": all(value >= 0 for value in positions.values()),
    "direct_dispatch_ordered": ordered,
    "receipt_call_in_get_branch": "receipt(" in branch,
    "policy_call_in_get_branch": "evaluate" in branch,
    "unmediated_branch_confirmed": ordered and "receipt(" not in branch and "evaluate" not in branch,
    "positions": positions,
}
print(json.dumps(result, indent=2, sort_keys=True))
