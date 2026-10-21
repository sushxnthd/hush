# Transaction-scope enforcement: result

## Smallest supported claim

For explicitly registered finite-map transactions whose adapter scopes are
declared by trusted local code, `ActionBroker` now binds the transaction id,
global authorization commitment, and local authorization commitment into the
ticket request hash and terminal receipt. Immediately before credential
resolution or adapter dispatch it revalidates both commitments and rejects any
local scope that does not factor through the transaction-wide scope.

This closes the previously demonstrated parity/coordinate enforcement gap for
the registered mode. It does not protect calls left unscoped, prove adapter
declarations truthful, or provide distributed persistence.

## Mechanism

1. Trusted local code registers an immutable transaction id, finite world set,
   and global authorization map. Raw maps remain broker-private; the public
   interface returns a SHA-256 commitment.
2. Trusted adapter registration binds each action to a local authorization map.
3. A scoped request snapshots that local map and commits the transaction id and
   both scopes into its request hash.
4. Immediately before credentials or side effects, the broker recomputes both
   commitments and invokes the exact factorization checker.
5. Non-factorizing, closed, missing, or mutated scopes produce a terminal denial
   receipt with zero adapter dispatches. Closing a transaction invalidates its
   outstanding tickets.

## Frozen prospective gates

| Case | Decision | Adapter dispatches |
|---|---:|---:|
| Identity-global `read_x`, `read_y` | 2 allows | 2 |
| Parity-global, x-first | first call denied | 0 |
| Parity-global, y-first | first call denied | 0 |
| Closed after ticket approval | denied | 0 |
| Local scope mutated after approval | denied | 0 |
| Global scope mutated after approval | denied | 0 |
| Ordinary unscoped control | allowed | 1 |

All frozen gates passed. The order-swap prediction passed: the first offending
coordinate changed, but the call was still denied before dispatch. The identity
control returned the same two ordinary values, and the unscoped control retained
the pre-existing behavior.

## Independent falsification

`scripts/audit-transaction-scope-enforcement.mjs` does not import the production
checker. It independently enumerates the frozen identity/parity fiber splits,
checks the primary artifact and every adversarial denial, verifies that the
scope check textually precedes credential resolution and adapter execution, and
requires all three ticket/receipt commitment bindings. It passed 19 checks with
zero mismatches.

The dedicated workflow regenerates the artifact twice, requires byte equality
with the committed primary result, runs the independent audit, focused tests,
and the complete repository suite.

## Priority and novelty boundary

Complete mediation, noninterference, authorization-policy proofs, and reference
monitor verification are established foundations. Proof-carrying authorization
systems already place policy evidence at a reference monitor, including session
and revocation-aware variants:

- J. H. Saltzer and M. D. Schroeder, *The Protection of Information in Computer
  Systems*, Proceedings of the IEEE 63(9), 1975,
  <https://doi.org/10.1109/PROC.1975.9939>.
- J. A. Goguen and J. Meseguer, *Security Policies and Security Models*, IEEE
  Symposium on Security and Privacy, 1982,
  <https://doi.org/10.1109/SP.1982.10014>.
- L. Bauer, M. A. Schneider, and E. W. Felten, *A Proof-Carrying Authorization
  System*, Princeton Technical Report TR-638-01, 2001,
  <https://users.ece.cmu.edu/~lbauer/papers/pcaprototr.pdf>.

No new general authorization or noninterference theorem is claimed. The Hush
contribution is the exact finite-fiber policy certificate wired into the actual
broker mediation point, commitment-bound tickets and receipts, and prospective
closure of a previously observed production attack while retaining utility.

## Project consequence

Registered transaction mode is now the candidate mandatory path for tool flows
that claim cumulative authorization. The preceding “checker exists but is not
enforced” blocker is closed for this finite trusted-local model. Production
promotion still requires persistent transaction storage, crash/restart replay
tests, and migration of real adapters to truthful scope declarations; unscoped
backward compatibility must not be described as protected.

## Limits

- Authorization maps and world sets are finite and registered explicitly.
- Adapter scope declarations are trusted local metadata; the broker cannot infer
  or verify arbitrary adapter semantics from code.
- Raw authorization maps are process-private, not protected against arbitrary
  code execution in the trusted local process.
- Transaction state is in memory and has no crash/restart or multi-process
  guarantee yet.
- Existing unscoped calls remain available and are outside this guarantee. The
  predecessor gap's static audit is retained as historical evidence: its
  unscoped paired trace remains reproducible, while its assertion that the
  broker had no scope fields is intentionally no longer a live regression.

## Reproduction

```bash
node scripts/verify-transaction-scope-enforcement.mjs \
  --output /tmp/transaction-scope-enforcement.json
node scripts/audit-transaction-scope-enforcement.mjs \
  --primary /tmp/transaction-scope-enforcement.json \
  --output /tmp/transaction-scope-enforcement-audit.json
node --test test/transaction-scope-enforcement.test.js test/action-broker.test.js
npm test
```
