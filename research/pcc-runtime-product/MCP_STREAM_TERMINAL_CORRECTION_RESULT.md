# MCP stream terminal correction result

## Status

**Frozen local mechanism gate: PASS. GitHub CI pending at this commit.**

## SCIENCE ledger

The preserved predecessor experiment established that clean EOF, upstream body
failure, and client cancellation all left the same signed
`attempt -> allow/outcome` trace. The correction replaces the header-time
outcome with a durable receipt-state machine keyed by a random `streamId`:

```
attempted -> opened -> complete | error | cancelled
```

The signed receipt chain is the authoritative durable state. At startup Hush
finds GET attempts with no terminal receipt and appends one reconciled
`error/process_restart` terminal. Before appending, it searches the chain for
an existing terminal with the same `streamId`; a second restart therefore
cannot duplicate the terminal fact.

The frozen real-server evaluation passed all five cases:

| Case | Independently observed condition | Signed terminal |
|---|---|---|
| clean EOF | two events and normal end | `complete` |
| upstream abort | source destroyed after first event | `error` |
| client cancellation | destination closed after first event | `cancelled` |
| upstream-first close race | source failure precedes scheduled client close | `error` |
| process death after open | SIGKILL, restart, second restart | one reconciled `error`; no duplicate |

Every upstream arrival observed one prior signed attempt. All receipt chains
validated. Brokered server authentication reached upstream, while neither the
server credential nor the deliberately supplied client credential entered
receipts. Two fresh complete executions were byte-identical after projecting
timestamps, hashes, signatures, ports, PIDs, and random identifiers.

The independent result/source-order audit passed **15/15** checks. The raw
result SHA-256 is
`b4611a22c4809a6ca7e78f4184aa8f041bb5d06b2ee36a65e550e682d6857609`;
the independent audit artifact SHA-256 is
`be0d923603976e6205bbd23b2dfbf6d328be03205d97df6f4f13b8ce6094cfae`.

## CONSEQUENCE ledger

Hush's MCP GET contract can now distinguish header acceptance from terminal
delivery without buffering a long-lived stream. The response header binds the
`opened` receipt; the later signed terminal receipt supplies the auditable
delivery result. This changes the runtime rather than merely documenting the
previous limitation.

The earlier pre-dispatch property survives unchanged:

- a signed attempt is durable before network dispatch;
- brokered credentials, not client credentials, reach upstream;
- clean, failed, cancelled, and crash-interrupted streams remain chain-bound.

The predecessor claim that an `allow/outcome` receipt was terminal is retired.
The supported contract is now explicitly three-stage and stream-aware.

## Verification record

- frozen correction runner: PASS;
- fresh-process byte comparison: PASS;
- independent audit: 15/15;
- migrated focused GET mediation regression: PASS;
- first full local suite: 338/339, with the sole failure caused by the legacy
  regression expecting two `attempt/outcome` receipts;
- legacy regression updated to require
  `attempt/opened/terminal-complete` on success and
  `attempt/terminal-error` before headers;
- final repository CI: pending.

The first full-suite failure is preserved as infrastructure/expectation evidence;
it was not a scientific failure and did not alter the frozen result.

## Smallest supported claim

For the frozen MCP GET lifecycle partition, Hush records a prior attempt and
exactly one signed terminal `complete`, `error`, or `cancelled` state; an
opened stream interrupted by process death is idempotently reconciled to
`error` on restart.

## Limitations

This is a scoped system mechanism result, not a new distributed-systems theorem
or a product-wide security proof. It does not establish exactly-once external
delivery, because bytes may reach a client immediately before a crash. It
establishes exactly one durable terminal **audit fact** in the tested
single-runtime Hush architecture. HTTP/2 multiplexing, multi-process writers,
machine loss between receipt persistence operations, and external deployment
validation remain outside the frozen partition.
