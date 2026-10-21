# Frozen protocol: transaction-scope enforcement gap

## Active kernel

- **Precise question.** Can Hush's current production `ActionBroker` enforce the
  cumulative authorization-join law, or is universal enforcement impossible
  because its requests and receipts omit transaction-wide authorization scope?
- **Best-known frontier.** The exact checker proves that local authorization
  composes under global authorization `G` iff every local scope factors through
  `G`. The checker passes exhaustive finite maps, but it is currently imported
  only by research tests, not the production action path.
- **Exact objective.** Construct two executions with byte-identical broker-visible
  requests, approvals, adapter results, and receipt fields but different global
  authorization contracts: one permits coordinate release and one permits only
  parity. Determine whether the broker can accept the former while rejecting
  the latter.
- **Strongest alternative explanation.** Existing ticket identity, one-shot
  approval, request hashes, or receipt chaining implicitly provides enough
  state to enforce transaction-wide scope without new metadata.
- **Cheapest decisive falsification.** If current production APIs can express a
  global transaction authorization and cause different pre-execution decisions
  for the paired traces, the impossibility candidate fails.
- **Mechanism-derived unseen prediction.** Swapping the order of the two
  coordinate actions changes receipt order and random identifiers but not the
  inability to distinguish the identity-global and parity-global contracts.
- **Publishable threshold.** A formal indistinguishability proposition; paired
  end-to-end production-broker traces with normalized byte-identical observable
  fields; independent static/API checker; frozen order-swap prediction; full
  regression and CI; explicit classical/non-novelty boundary.
- **Project-consequence threshold.** Either demonstrate a real existing
  production enforcement path, or prove the current API cannot enforce the law
  and freeze the minimum corrective contract: transaction id, global scope
  commitment, local-scope commitment, and fail-closed pre-execution check.
- **Kill condition.** Any hidden broker-visible field distinguishes the paired
  authorization contracts, or the claimed gap depends on bypassing an existing
  production guard.

## Frozen proposition

Let a broker's decision function depend only on its existing per-call request,
ticket, approval, and receipt history. If two executions have identical values
for all of those inputs but differ only in an unrepresented global
authorization contract, the broker must make the same decision in both.
Therefore it cannot both preserve utility for the permissive contract and
enforce the parity-only contract. A transaction-wide authorization commitment
is necessary information for universal enforcement.

## Frozen paired traces

Trusted local adapter state is `world=(x,y)=(1,1)` and exposes two separately
approved actions, `read_x` and `read_y`, with empty AI-supplied arguments.

1. **Permissive contract:** the transaction authorizes the identity `(x,y)`.
2. **Protected contract:** the transaction authorizes only `x XOR y`.

The production broker receives the same calls in both cases because its API has
no global-contract field. Both local actions are approved and executed. The
normalized result sequence is predicted to be `[1,1]` in both runs. Under the
protected contract this distinguishes worlds `00` and `11`, which share parity.

Repeat with action order reversed. Normalize random ids, timestamps, and hashes
that are consequences of those random ids; all authorization-relevant fields
must remain identical across the paired contracts.
