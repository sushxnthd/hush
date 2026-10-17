# MCP stream lifecycle mediation result

## Decisive falsification

Hush's current MCP GET `allow/outcome` receipt is not a terminal stream receipt.
It is written after upstream response headers arrive and before the response body
is piped. A real-server adversarial test produced the same two-receipt trace for
three observably different endings:

| Frozen scenario | Client observation | Final receipt projection |
|---|---|---|
| clean EOF | two events, normal completion | `approved/attempt`, `allow/outcome` |
| upstream body abort | one event, aborted response | `approved/attempt`, `allow/outcome` |
| client cancellation | one event, client-cancelled response | `approved/attempt`, `allow/outcome` |

All three requests reached the local observation upstream with Hush's brokered
credential only after a signed attempt receipt was durable. All chains remained
valid and no raw credential appeared in receipt material. The failure is
strictly later: after the first event, clean completion, upstream failure, and
client cancellation remained receipt-indistinguishable, with no `complete`,
`error`, or `cancelled` lifecycle terminal.

Two fresh-process executions were byte-identical. Result SHA-256:
`a9f580c551bef5dd15505d98966a05a4439f290fd6d1166f68ef7e542aec883f`.
The independent source/dynamic audit passed 10/10 checks, and the full repository
suite passed 339/339.

## Exact mechanism

In `src/server.js`, the GET branch appends `allow/outcome` immediately after
`fetch` resolves to response headers. Only afterward does it call
`pipeMcpResponse`. That pipeline contains no receipt append. Consequently:

1. a successful HTTP status is conflated with successful body completion;
2. an upstream body failure cannot revise or close the recorded allow;
3. downstream cancellation is not durably classified; and
4. the response header binds the client to a receipt that predates the stream's
   actual terminal state.

This does not invalidate the earlier pre-dispatch result. Upstream arrival still
implies a prior signed attempt, and connection failure before headers still
receives an error outcome. It falsifies only the stronger terminal-closure claim
for long-lived or streamed bodies.

## Ledgers

### SCIENCE

- Clean EOF, upstream body failure, and client cancellation are dynamically
  distinguishable but receipt-equivalent at the current runtime boundary.
- The counterexample survives two fresh processes and an independent source-order
  audit.
- Smallest supported claim: GET receipts currently certify dispatch and response
  headers, not completed stream lifecycle.

### CONSEQUENCE

- Narrow Hush's current assurance claim from “terminal MCP GET mediation” to
  “pre-dispatch plus response-header mediation.”
- Add a lifecycle state machine around `pipeline`: `complete` only after normal
  EOF, `error` after upstream/body failure, and `cancelled` after downstream
  cancellation.
- Bind each terminal record to the attempt and header receipt while guaranteeing
  exactly one terminal classification under racing close/error events.
- Do not claim product-wide complete mediation until that prospective correction
  passes the unchanged three-scenario test plus crash reconciliation.

## Active kernel after this result

The header-level terminal claim is **killed**. The active HUSH kernel is now a
single prospective correction: an exactly-once stream lifecycle receipt state
machine with restart reconciliation for attempts left open by process death.

## Limitations

This is a local deterministic Node/HTTP/SSE test, not a live-provider study. It
does not prove loss of upstream confidentiality or authorization bypass; the
credentialed dispatch remained pre-receipted. It does not yet cover HTTP/2,
multiple concurrent streams, backpressure exhaustion, or hard process death.
