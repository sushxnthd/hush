# MCP POST complete-mediation result

Date: 2026-10-17 UTC

## Decisive finding

The preregistered static audit falsified the pre-existing product-wide claim at
commit `d82712ad5b875c8505a787ab11cf50b1c4db98fe`: generic MCP JSON-RPC POSTs
were forwarded with Hush's brokered credential and no receipt, while approved
`tools/call` wrote its only receipt after the upstream returned. A crash or
hanging upstream could therefore erase evidence that a credentialed external
attempt occurred.

The correction routes both POST dispatch sites through one
`dispatchMcpPost` choke point. It writes a signed `approved` attempt before
network dispatch, writes an `allow` or `error` outcome after the HTTP result,
closes thrown transport errors, labels the authorization basis, excludes raw
credentials, and returns the terminal receipt hash to the client. The exact
one-shot tool approval still precedes the choke point.

## Frozen prospective test

The real-process runner exercised the 14 frozen protocol classes plus the
second approval precursor required to reach the frozen upstream-error case:
15 cases total. Five requests legitimately reached the observing upstream:
`initialize`, `tools/list`, an unknown request method, an exactly approved
successful tool call, and an exactly approved tool call receiving HTTP 503.

- 5/5 upstream arrivals observed the signed attempt as Hush's newest durable
  receipt at arrival time.
- 5/5 completed arrivals produced exactly one terminal outcome.
- 10/10 local, malformed, notification, denied, or approval-pending cases had
  zero upstream arrivals.
- The denied raw-secret tool call remained denied before dispatch.
- The brokered server credential reached the upstream; the client credential
  did not replace it; neither credential value appeared in receipt artifacts.
- The HTTP 503 case closed with decision `error` and returned its terminal
  receipt hash.

The independent source-order audit passed 9/9 gates, including exactly one
raw POST call to `fetchMcpUpstream`, located inside the choke point, and both
call sites using that helper.

## SCIENCE ledger

Supported, within the frozen unary POST partition: upstream arrival implies a
prior signed attempt, and normal HTTP completion implies one terminal outcome.
This converts an informal logging property into a falsifiable happens-before
invariant observed from the external-effect boundary.

## CONSEQUENCE ledger

Hush now has a single regression-gated POST dispatch boundary for brokered MCP
credentials. Operators can distinguish an attempted credentialed effect from
its outcome even when an upstream returns an error, and clients receive the
terminal receipt hash on proxied POST responses.

## Smallest supported claim

Across the frozen 15-case unary POST evaluation, every one of five brokered
upstream arrivals had a signed Hush attempt receipt already durable at arrival
and exactly one terminal HTTP outcome; every local or rejected class had zero
upstream arrivals. This is a system invariant, not a novelty claim about
JSON-RPC, audit logs, or typed declassification.

## Limitations and next boundary

- Unknown request methods are accounted under the configured-upstream
  transport authorization basis, not semantically authorized. A future method
  may be side-effectful; method semantics need a deny-by-default capability
  registry before Hush can claim permission-complete generic passthrough.
- A process kill after the durable attempt but before outcome leaves an open
  attempt. Reconciliation of open attempts is not yet implemented.
- Streaming lifecycle semantics and remote session revocation are outside this
  unary POST result.
- The result is an internal controlled evaluation, not an external deployment
  or an independent third-party replication.

Artifacts:

- `MCP_POST_COMPLETE_MEDIATION_PREREGISTRATION.md`
- `run_mcp_post_complete_mediation.mjs`
- `mcp_post_complete_mediation_result.json`
- `audit_mcp_post_complete_mediation.py`
- `mcp_post_complete_mediation_static_audit.json`
