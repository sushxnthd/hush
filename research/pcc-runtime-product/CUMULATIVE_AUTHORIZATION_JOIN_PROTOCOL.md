# Cumulative Authorization-Join Protocol

Status: frozen before enumeration and prospective fixtures.

## Active kernel

- **Question.** When do separately approved tool calls compose without disclosing more about a private world than the enclosing broker transaction authorizes?
- **Best-known frontier.** Hush already checks cumulative observation partitions and scheduler-fiber composition. Those controls do not yet give a scope rule for combining receipts whose approvals were issued against different local authorization maps.
- **Objective.** Derive a necessary-and-sufficient structural criterion, implement a fail-closed checker with a minimal witness, exhaust all binary maps on four worlds, and test the criterion on frozen unseen eight-world/three-call fixtures.
- **Strongest alternative explanation.** This may be only the classical partition-refinement/noninterference rule restated for receipts, with no additional runtime consequence beyond the existing partition firewall.
- **Cheapest decisive falsification.** One disagreement between the structural criterion and exhaustive universal composition, or one prospective fixture for which the checker predicts the wrong safe/unsafe result.
- **Mechanism-derived unseen prediction.** Adding a locally safe call preserves universal global safety exactly when its local authorization map is constant on every global-authorization fiber. A constant-observation slack call cannot repair or create a violation.
- **Publishable threshold.** Exact theorem and proof; exhaustive independent checks; an adversarial split-approval witness; a literature-priority audit; and an executable broker rule that identifies the first violating call and world pair.
- **Project-consequence threshold.** Hush must bind every local approval receipt to a transaction-wide authorization scope and reject a call before release when its authorization partition refines a protected global fiber.
- **Kill condition.** Any exhaustive disagreement, checker/oracle disagreement, or inability to distinguish the rule from the already-enforced cumulative observation check without a concrete new broker decision.

## Frozen formal claim

Let `W` be the finite set of private worlds, `G: W -> Y` the transaction-wide authorization, and `A_i: W -> Y_i` the authorization used for local call `i`. An observation `O_i` is locally safe when it factors through `A_i`:

`A_i(w) = A_i(w') => O_i(w) = O_i(w')`.

All locally safe observations compose safely under `G` if and only if

`G(w) = G(w') => A_i(w) = A_i(w')` for every call `i`.

Equivalently, `ker(G)` is contained in `intersection_i ker(A_i)`. Necessity selects `O_i = A_i`. Sufficiency follows by transitivity of factorization and by the kernel of the joint observation being the intersection of the component kernels.

This is a universal scope criterion. A second, outcome-specific check tests the observations actually released and may pass even when universal composition fails (for example, a constant observation under an overbroad local approval).

## Frozen exact protocol

1. Enumerate all `2^4 = 16` binary maps on the ordered worlds `00, 01, 10, 11`.
2. For every triple `(G, A_1, A_2)` (4,096 authorization systems), enumerate every binary `O_1` factoring through `A_1` and every binary `O_2` factoring through `A_2`.
3. Define the oracle universal result as true iff every locally safe pair `(O_1, O_2)` has joint observation factoring through `G`.
4. Compare the oracle with the frozen structural criterion above. Required result: zero disagreements.
5. Independently reimplement the enumeration in Python without importing the JavaScript checker.
6. Freeze prospective fixtures before running them. They include parity-vs-coordinate split approval, globally scoped safe calls, constant slack calls, and seeded eight-world maps with three local calls.

## Frozen adversarial witness

For worlds `(x,y)`, let global authorization be `x XOR y`, while call 1 authorizes/releases `x` and call 2 authorizes/releases `y`. Each release is safe for its own local approval. The tuple `(x,y)` distinguishes `00` from `11`, which the global parity authorization requires to remain indistinguishable. The predicted first violation is call 1 for the pair `00/11`; swapping call order changes the first local witness but not the final failure.

## Reporting discipline

The smallest supported claim will distinguish: (a) the classical finite-partition theorem, (b) the Hush-specific receipt-scope enforcement consequence, and (c) any unvalidated claim of novelty. Negative results, failed gates, exact seeds, raw counts, and CI state remain in the branch.
