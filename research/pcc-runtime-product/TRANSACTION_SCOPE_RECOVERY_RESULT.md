# Transaction-scope crash recovery: result

## Status and smallest claim

**Frozen local mechanism gate: PASS. Full local regression: 360/360. GitHub CI
pending at this commit.**

On Hush's single-writer local runtime, a synchronously persisted encrypted
transaction snapshot survives process death, preserves the finite-map
authorization decisions of open transactions, preserves closure monotonically,
and fails closed when recovery uses the wrong key or modified ciphertext.

This removes the explicit crash/restart blocker from the registered transaction
mode. It does not establish exactly-once external side effects, distributed
agreement, rollback resistance against replacement with an older valid file, or
truthfulness of adapter scope declarations.

## Frozen prospective result

The writer process registered open identity and parity transactions plus a
closed identity transaction, acknowledged completion only after synchronous
atomic persistence, and was then killed with `SIGKILL`. A fresh process loaded
the same encrypted snapshot.

| Frozen case | Result |
|---|---|
| open identity after restart | `read_x`, `read_y` both allowed |
| open parity after restart | `read_x` denied before dispatch |
| closed identity after restart | request rejected as closed |
| wrong platform key | construction failed closed |
| one-bit ciphertext modification | construction failed closed |
| unscoped control | unchanged allow behavior |

Only the two identity actions reached the adapter. The result reproduced
byte-identically across two fresh runs. The primary artifact SHA-256 is
`6e27aa0c1b0eaa7b3781b45caee775db7f603084eade9bb0754bf578642e1778`.

## Mechanism and independent falsification

`EncryptedAuthorizationStateStore` stores versioned transaction snapshots under
AES-256-GCM using the runtime's platform-root key. Hush's existing atomic writer
fsyncs the temporary file, renames it, and fsyncs the containing directory.
Registration and closure return only after that write; a persistence error rolls
back the in-memory mutation. Recovery authenticates and decrypts the file,
revalidates every finite map, and recomputes every commitment before installing
state. The production server now supplies this store to its real action broker.

The independent checker does not import the production factorization function.
It recomputes the identity/parity distinction, checks exact decisions and
dispatches, and audits encryption, commitment reconstruction, mutation ordering,
and recovery-before-use. It passed 10/10 checks. Audit artifact SHA-256:
`ac526a003ccd32aa6fbd0d7d1592b08d76c8e916ba6befd3868e6bd06e0219c0`.

Two checker-only failures are preserved in
`transaction_scope_recovery_failed_gate.txt`: one ambiguous source-order search
and one JSON object-order comparison. Neither changed the frozen mechanism,
primary result, threshold, or expected decisions.

## Priority and novelty boundary

Atomic durable state, authenticated encryption, reference monitors, and
crash-recovery state machines are established systems techniques. No generic
novelty is claimed for persistence or encryption. The contribution is a narrow
Hush system result: the exact cumulative-authorization certificate is now
carried across real runtime restart without exposing its raw maps, while closure
and adversarial recovery remain fail-closed. The authorization-theory priority
boundary remains documented in `TRANSACTION_SCOPE_ENFORCEMENT_RESULT.md`.

## Project consequence

The registered finite transaction mode is no longer process-lifetime-only on a
single Hush runtime. The next production boundary is semantic rather than
storage plumbing: real adapters must provide truthful, versioned scope
declarations, and valid-snapshot rollback or multi-host operation would require
an external monotonic anchor or consensus mechanism.

