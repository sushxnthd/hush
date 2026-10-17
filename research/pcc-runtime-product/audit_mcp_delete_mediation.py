#!/usr/bin/env python3
"""Independent source-order check for the frozen MCP DELETE candidate."""

import hashlib
import json
from pathlib import Path


source_path = Path("src/server.js")
source = source_path.read_text(encoding="utf-8")

markers = {
    "mcp_function": "async function mcp(req,res,u){",
    "early_delete_branch": "if(req.method==='GET'||req.method==='DELETE')",
    "early_dispatch": "const upstream=await fetchMcpUpstream(req,u,null);",
    "json_parse": "try{rpc=raw.length?JSON.parse(raw.toString()):null}",
    "tool_policy": "let evaluation=evaluateMcpCall(",
    "receipt": "receipt(audit,upstream.ok?'allow':'error'",
}
positions = {name: source.index(marker) for name, marker in markers.items()}
ordered_bypass = (
    positions["mcp_function"]
    < positions["early_delete_branch"]
    < positions["early_dispatch"]
    < positions["json_parse"]
    < positions["tool_policy"]
    < positions["receipt"]
)
result = {
    "protocol": "mcp-delete-static-order-audit-v1",
    "source_sha256": hashlib.sha256(source.encode()).hexdigest(),
    "all_markers_found": all(value >= 0 for value in positions.values()),
    "early_dispatch_precedes_policy_and_receipt": ordered_bypass,
    "scientific_gate": "FAIL" if ordered_bypass else "PASS",
    "positions": positions,
}
print(json.dumps(result, indent=2, sort_keys=True))
