import json
from pathlib import Path

source = Path('src/server.js').read_text()
helper_start = source.index('async function dispatchMcpPost(')
helper_end = source.index('\nasync function mcp(', helper_start)
helper = source[helper_start:helper_end]
mcp = source[helper_end:source.index('\nasync function api(', helper_end)]

checks = {
    'single_raw_post_dispatch_in_helper': source.count('await fetchMcpUpstream(req,u,raw)') == 1 and 'await fetchMcpUpstream(req,u,raw)' in helper,
    'attempt_precedes_dispatch': helper.index("phase:'attempt'") < helper.index('fetchMcpUpstream(req,u,raw)'),
    'transport_error_closed': "phase:'outcome',status:'error'" in helper,
    'http_outcome_closed': "phase:'outcome',status:upstream.ok?'allow':'error'" in helper,
    'raw_credential_excluded': helper.count('rawCredentialIncluded:false') == 3,
    'tool_call_uses_choke_point': 'authorizationBasis:hadApproval' in mcp and 'dispatchMcpPost({' in mcp,
    'generic_post_uses_choke_point': "authorizationBasis:'configured_mcp_upstream'" in mcp,
    'one_shot_gate_precedes_tool_dispatch': mcp.index("if(evaluation.decision==='ask')") < mcp.index("authorizationBasis:hadApproval"),
    'terminal_hash_returned': mcp.count("'x-hush-receipt-hash':outcome.hash") >= 3,
}
result = {'schema_version': 1, 'checks': checks, 'passed': all(checks.values())}
Path('research/pcc-runtime-product/mcp_post_complete_mediation_static_audit.json').write_text(json.dumps(result, indent=2, sort_keys=True) + '\n')
print(json.dumps(result, indent=2, sort_keys=True))
if not result['passed']:
    raise SystemExit(1)
