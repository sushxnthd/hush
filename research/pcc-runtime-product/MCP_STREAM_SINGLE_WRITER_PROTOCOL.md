# MCP stream single-writer boundary: frozen protocol

## Active HUSH kernel

### Precise question

Does the corrected `attempted -> opened -> terminal` receipt mechanism retain
durable append completeness when two Hush processes share one receipt store, or
does its in-memory `push` plus whole-file atomic replacement require an
undocumented single-writer assumption?

### Best-known frontier

PR #37 establishes exactly one terminal receipt for clean EOF, upstream error,
client cancellation, a teardown race, and crash/restart in one Node runtime.
The underlying store loads `receipts.json` into process memory; `addReceipt`
pushes locally and atomically replaces the full JSON file. Atomic replacement
prevents torn JSON but does not by itself serialize independent read-modify-write
cycles.

### Exact objective

Across 100 fresh stores, start two processes, ensure both have loaded the same
empty durable receipt snapshot, release them through one barrier, and have each
append a distinct receipt. Compare with a two-append sequential single-process
control. Record only stable counts, not scheduling-dependent winner identity.

### Strongest alternative explanation

`atomicWriteJson` may be sufficient because filesystem replacement is atomic,
leaving both receipts durable even when each process loaded before the barrier.

### Frozen prediction

The JSON file remains parseable but exactly one of the two concurrent receipts
survives in every round; the sequential control retains both.

### Cheapest decisive falsification

Reject the prediction if any concurrent round retains two receipts, produces
invalid JSON, or the sequential control loses a receipt.

### Publishable threshold

This counterexample alone is not publishable novelty. A publishable systems
result would require a corrected append protocol, crash injection at every
write phase, and cross-platform replication.

### Project-consequence threshold

If the prediction survives, Hush must either enforce an explicit exclusive
single-instance lease or replace snapshot persistence with a transactional
append log before extending the stream exactly-once claim beyond one runtime.

### Kill condition

Kill this boundary if concurrent writers preserve both receipts in all 100
rounds and an independent source audit finds storage-level serialization.

## Ledgers

**SCIENCE:** distinguish atomic file replacement from atomic durable append.

**CONSEQUENCE:** determine whether PR #37's lifecycle guarantee is a runtime law
or a single-writer deployment contract.
