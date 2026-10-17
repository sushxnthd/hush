# MCP stream lifecycle mediation: preregistration

## Active kernel

HUSH only. This is the remaining long-lived transport boundary after unary MCP
GET, POST, and unsupported DELETE received scoped mediation contracts.

## Precise question

Does Hush durably distinguish successful stream completion from mid-body
upstream failure and client cancellation, or is its current `allow/outcome`
receipt written at response-header time and therefore non-terminal?

## Best-known frontier

The current GET path writes an approved attempt before dispatch and an
`allow/outcome` after upstream headers arrive, then pipes the body. This proves
pre-dispatch visibility and header-level response binding. It does not by itself
prove that the stream completed, failed, or was cancelled.

## Exact objective

Run the real Hush server against a deterministic local SSE upstream in three
fixed scenarios:

1. `clean_eof`: two events followed by normal upstream EOF;
2. `upstream_abort`: one event followed by destruction of the upstream body;
3. `client_cancel`: one event followed by client cancellation while upstream
   remains open.

For each scenario, record signed receipt projections at upstream arrival, after
the first client-visible event, and after the actual terminal condition. Record
response status, delivered events, upstream socket state, receipt phases,
decisions, stream terminal classification, and chain validity. Run twice in
fresh processes and require byte-identical canonical output after removing
ephemeral ports, process IDs, timestamps, signatures, and hashes.

## Measurable gate

A stream is completely mediated only if:

- upstream arrival observes a durable approved attempt;
- no receipt claims successful completion before body termination;
- normal EOF produces exactly one `complete` terminal classification;
- upstream body failure produces exactly one `error` terminal classification;
- client cancellation produces exactly one `cancelled` terminal classification;
- every terminal receipt is signed, chained, and bound to the attempt; and
- raw client or brokered credentials never enter receipt material.

## Strongest alternative explanation

Node's response pipeline may propagate body failure or cancellation into the
outer request handler, which could already append a correct terminal outcome or
otherwise make the early header receipt harmless. The dynamic snapshots decide
this directly.

## Cheapest decisive falsification

If `upstream_abort` or `client_cancel` leaves only the pre-body
`allow/outcome`, with no later error/cancelled terminal evidence, then the
current claim of terminal stream closure is false. A clean EOF that is
indistinguishable in receipts from either abnormal ending is sufficient.

## Publishable success and project relevance

- **Success:** a reproducible real-server lifecycle counterexample or a complete
  three-scenario invariant with independent source-order audit.
- **Consequence:** either add a post-pipeline terminal receipt state machine, or
  narrow Hush's assurance contract to dispatch/header mediation only.
- **Kill:** non-reproducible transport behavior, invalid observation timing, or
  a probe that bypasses the real server/pipeline.

## Holdout and reporting rule

No privacy/task holdout is opened. This is a transport-mechanism adversarial
test. Report the smallest scoped claim; do not call header-level allow a
completed-stream receipt.
