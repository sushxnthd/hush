# MCP stream terminal correction: preregistration

## Active kernel

HUSH only. This is the corrective experiment implied by the preserved
three-ending counterexample on `GET /mcp`.

## Precise question

Can Hush persist an exactly-once terminal state for every brokered MCP GET
stream, distinguish clean completion, upstream body failure, and client
cancellation under adversarial races, and reconcile a process death without
weakening the already-demonstrated pre-dispatch mediation boundary?

## Best-known frontier

The current path durably records an approved attempt before dispatch and an
`allow/outcome` when upstream headers arrive. The frozen counterexample shows
that clean EOF, upstream abort, and client cancellation then leave identical
receipts. Header acceptance is therefore non-terminal. The relevant systems
frontier is durable workflow/outbox-style state transition: name the operation,
persist its open state, append one terminal fact, and make recovery idempotent.
This run does not claim that pattern as new.

## Exact objective

Implement a persistent per-stream state machine with a stable random
`streamId`:

`attempted -> opened -> complete | error | cancelled`.

Freeze and execute these cases against the real Hush server and deterministic
local SSE upstream:

1. normal two-event EOF;
2. upstream body destruction after one event;
3. client cancellation after one event;
4. an upstream-failure/client-close race;
5. process death after `opened`, followed by restart reconciliation.

The attempt must exist before upstream arrival. Each stream must have exactly
one signed terminal receipt linked by `streamId`; restart may append a terminal
`error` only when no terminal receipt already exists. Raw client or brokered
credentials must never enter lifecycle state or receipts.

## Strongest alternative explanation

The three original outcomes may be distinguishable only in a cooperative test.
Node stream teardown can surface the same premature-close error on both source
failure and destination cancellation, and an apparently idempotent in-memory
guard can duplicate or lose terminal facts across a crash.

## Cheapest decisive falsification

Kill the correction if any frozen case has one of the following:

- upstream arrival without a prior signed attempt;
- zero or more than one terminal receipt for a `streamId`;
- clean EOF not classified `complete`;
- upstream-first failure not classified `error`;
- client-first cancellation not classified `cancelled`;
- an open stream left unreconciled after restart;
- a second restart appending a duplicate terminal receipt;
- an invalid signed chain or raw credential persistence.

## Publishable success condition

A real-server adversarial result, independently audited from raw receipts and
source order, in which all five cases satisfy the exact state-machine law and
fresh runs are byte-identical after removing timestamps, signatures, hashes,
ports, PIDs, and random identifiers. This is a scoped system result, not a new
distributed-systems theorem.

## Project-relevance threshold

Success changes Hush's runtime and assurance contract from header-level
observation to auditable terminal delivery for brokered MCP GET streams. Failure
must narrow the public claim and preserve the minimal race or crash
counterexample.

## Kill condition

Kill or reformulate this correction after one exact lifecycle violation, or if
the mechanism requires buffering the full stream before delivery. Buffering
would destroy the intended long-lived MCP capability and does not count as a
usable Hush result.

## Holdout integrity

No privacy/task-family holdout is opened. All scenarios are deterministic
transport tests derived from the already-opened lifecycle counterexample.
