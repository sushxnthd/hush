# Transaction-scope enforcement gap: result

## Smallest supported claim

The current production `ActionBroker` API cannot universally enforce Hush's
cumulative authorization law. Its decision inputs omit the global transaction
authorization scope, so two executions with identical broker-visible requests,
approvals, results, and receipt histories receive identical decisions even when
one global contract permits the disclosure and the other forbids it.

This is a necessity result for the current API, not a claim that transaction
metadata alone is sufficient. Universal enforcement requires, at minimum, a
transaction id, a commitment to the global authorization, a commitment to each
local authorization, and a fail-closed pre-execution factorization check.

## Formal proposition

Let `B(v)` be any deterministic broker decision whose complete input is the
existing broker-visible state `v`: the current request, ticket, approval, and
prior receipt history. Let executions `E_id` and `E_xor` have equal visible
state at every decision point but different unrepresented global authorization
contracts: identity `(x,y)` for `E_id` and parity `x XOR y` for `E_xor`.

Because `v_id = v_xor`, extensionality gives
`B(v_id) = B(v_xor)`. Preserving both coordinate reads under identity requires
`B(v_id) = allow` at both calls, hence the broker also allows both calls in
`E_xor`. But worlds `00` and `11` have equal parity and unequal coordinate
observations, so either coordinate disclosure violates the parity contract.
Therefore no decision function over only the current API inputs can both
preserve the permitted identity execution and reject the forbidden parity
execution. A representation of the distinguishing global contract is necessary.

The same argument applies to randomized brokers after fixing their random tape;
without a contract-dependent input they have the same decision distribution in
both executions and cannot obtain perfect utility in one and perfect enforcement
in the other.

## Frozen prospective test

The hidden adapter world was fixed to `(x,y)=(1,1)`. Two separately approved
actions release `x` and `y`. The same production-broker calls were run under an
identity-global oracle and a parity-global oracle. The contract label was not
passed to `ActionBroker`, because no such public input exists. Random ids and
timestamps were removed before comparing authorization-relevant traces.

| Check | Result |
|---|---:|
| Frozen action orders | 2 |
| Paired executions | 4 |
| Approved actions | 8/8 |
| Broker-visible mismatches | 0 |
| Protected-contract rejections | 0 |
| Exact-oracle contract separations | 2/2 |
| Released protected result | `[1,1]` in both orders |

The unseen order-swap prediction passed. Reversing `read_x, read_y` to
`read_y, read_x` changed the first exact witness from `read_x` to `read_y`, but
did not change the production decision or released values. In both orders the
exact checker certified the identity contract and rejected the parity contract
with the witness pair `00,11` at prefix 1.

## Independent checks

`scripts/audit-transaction-scope-gap.mjs` independently re-parses the frozen
primary artifact, requires exact equality of both paired normalized traces,
checks the oracle separation and `[1,1]` release, and statically inspects the
production broker. It confirmed that `src/action-broker.js` contains no
`transactionId`, global authorization, authorization-scope commitment, or
import of the cumulative authorization checker.

The dedicated test invokes the primary verifier and independent audit from
fresh temporary outputs. The workflow reproduces the primary artifact twice,
requires byte equality with the committed artifact, runs the independent audit,
and then runs the full test suite.

## Priority and novelty boundary

The general principles are classical. Saltzer and Schroeder's 1975 protection
principles require complete mediation and fail-safe defaults, and Goguen and
Meseguer's 1982 security model formalizes indistinguishability of observations
under noninterference policies:

- J. H. Saltzer and M. D. Schroeder, *The Protection of Information in Computer
  Systems*, Proceedings of the IEEE 63(9), 1975,
  <https://doi.org/10.1109/PROC.1975.9939>.
- J. A. Goguen and J. Meseguer, *Security Policies and Security Models*, IEEE
  Symposium on Security and Privacy, 1982,
  <https://doi.org/10.1109/SP.1982.10014>.

Accordingly, this result is not presented as a new general impossibility
theorem. The externally defensible Hush contribution is narrower: an exact API
necessity boundary and paired end-to-end falsification showing that the already
proved cumulative authorization law is not enforced by the current production
broker path.

## Project consequence

The cumulative authorization theorem and checker survive, but the production
enforcement interpretation does not. Hush must not describe the current module
as production enforcement. The next kernel is implementation and adversarial
validation of transaction-bound scope commitments plus a fail-closed
pre-execution factorization check. A valid implementation must reject the
parity-protected pair before either forbidden adapter execution while preserving
both identity-authorized calls.

The existing production-readiness workflow remains red for exact-source release
evidence. That is expected and correct: historical signed release evidence must
not be relabeled as certifying changed source. This run does not alter or waive
that gate.

## Limits

- The exact oracle uses finite maps over four worlds; it does not establish
  completeness for arbitrary infinite or probabilistic systems.
- The attack uses a synthetic trusted local adapter, not a normal Google
  adapter or a demonstrated remote exploit.
- Each local action receives explicit approval. The failure is that per-action
  approval is insufficient to represent the stricter transaction-wide parity
  contract, not that approval is absent.
- The result establishes necessary information and a missing mediation point;
  it does not yet prove a distributed, crash-safe, or replay-safe implementation.

## Reproduction

```bash
node scripts/verify-transaction-scope-gap.mjs \
  --output /tmp/transaction-scope-primary.json
node scripts/audit-transaction-scope-gap.mjs \
  --primary /tmp/transaction-scope-primary.json \
  --output /tmp/transaction-scope-audit.json
npm test
```
