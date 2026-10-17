# MCP POST complete-mediation preregistration

Date frozen: 2026-10-17 UTC

## Active kernel

Can Hush's user-controlled permission/runtime layer guarantee that every MCP
POST capable of exercising a brokered upstream credential is durably visible
before dispatch and terminally closed after dispatch, while preserving local
MCP utility?

## Static falsification found before intervention

At commit `d82712ad5b875c8505a787ab11cf50b1c4db98fe`, `mcp()` contains two POST
dispatch sites. The generic JSON-RPC passthrough calls `fetchMcpUpstream`
without any receipt. The `tools/call` path writes a receipt only after the
upstream returns. Therefore a process death, timeout, or hanging upstream can
leave an externally credentialed attempt absent from Hush's ledger. This is
the strongest alternative explanation to any claim that POST was already
completely mediated.

## Frozen method classes

The decisive runner will send these mutually exclusive classes to a real
Hush process backed by an observing HTTP upstream:

1. invalid JSON;
2. JSON-RPC batch;
3. structurally invalid request;
4. allowed notification;
5. unsupported notification;
6. local `server/discover`;
7. local `ping`;
8. upstream `initialize`;
9. upstream `tools/list`;
10. unknown request method;
11. denied `tools/call`;
12. approval-required `tools/call`;
13. exactly approved successful `tools/call`;
14. exactly approved upstream-error `tools/call`.

## Exact objective

For every class, record response status, upstream-arrival delta, receipt
delta, receipt phases and brokered authorization observation. Required:

- every local or rejected class has upstream-arrival delta zero;
- every upstream arrival has exactly one signed `approved` attempt receipt
  already observable when the upstream receives the request;
- every completed upstream request has exactly one terminal `allow` or
  `error` outcome linked by the same request fingerprint;
- no receipt contains the raw credential;
- local discovery, ping, notifications and rejection behavior remain usable.

## Cheapest decisive falsification

An observing upstream snapshots `/api/receipts` at request arrival. One
upstream arrival without its attempt receipt, one local/rejected class that
arrives upstream, one missing terminal outcome, or one raw credential in a
receipt falsifies complete mediation.

## Intervention boundary

Replace both POST dispatch sites with one helper that emits an attempt before
`fetchMcpUpstream`, catches transport errors, and emits a terminal outcome.
The helper must not weaken the existing exact one-shot `tools/call` approval
gate. Generic request methods are authorized only by the configured-upstream
transport boundary and must be labeled as such; this is accounting, not a
claim of semantic authorization.

## Success, relevance, and kill conditions

Publishable success requires the frozen matrix to pass plus an independent
static audit proving that all POST calls to `fetchMcpUpstream` occur inside
the helper. Project relevance requires this helper to become the runtime
choke point for brokered POST effects and CI to fail on a new direct dispatch.

Kill the stronger claim immediately if any brokered POST can reach upstream
without a pre-dispatch attempt or if any `tools/call` reaches upstream without
its existing policy/approval decision. Even on success, this does not prove
semantic authorization for unknown methods or closure for process-kill after
attempt; those remain explicit limitations.

## Ledgers

SCIENCE: test whether the observable invariant “upstream arrival implies a
prior durable attempt” can be made exact across the complete unary POST
method partition.

CONSEQUENCE: if supported, Hush's MCP runtime changes from method-specific
best-effort logging to a single enforceable POST dispatch choke point with a
regression gate. If falsified, the product-wide complete-mediation claim is
withdrawn and the counterexample is preserved.
