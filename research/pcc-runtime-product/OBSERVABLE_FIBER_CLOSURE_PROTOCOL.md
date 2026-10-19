# Frozen protocol: observable-fiber closure

Date frozen: 2026-10-19
Branch: `breakthrough-engine/observable-fiber-closure-20261019`

## Active HUSH kernel

**Precise question.** For an approval-mediated deterministic runtime, which auxiliary observables can be exposed without leaking private-result information beyond the authorized release, and can the criterion be enforced mechanically across runtime traces?

**Best-known frontier.** Noninterference, observational determinism, constant-time programming, and post-processing/data-processing principles are established. Hush already corrected secret-dependent clause-evaluation multiplicity for bounded `choose`. This run does not claim novelty for factorization through an authorized release.

**Exact objective.** Establish and operationalize the finite deterministic fiber criterion: for public input x, authorized release R(x,s), and exposed runtime trace O(x,s), zero auxiliary distinction on secrets already identified by R holds iff O is constant on every fiber of R, equivalently O=f_x composed with R for some f_x. For adaptive sequences, test prefix closure: every pre-approval/public trace prefix must be constant on the current authorized-transcript fiber.

**Strongest alternative explanation.** The criterion is only classical noninterference restated and finds no new production failure after the fixed-work correction.

**Cheapest decisive falsification.** Enumerate finite private worlds and production-faithful trace projections over result, status, error class, event order, item multiplicity, byte length, and work count. Any checker false negative, any claimed-safe trace with two different observations on one release fiber, or inability to change an actual Hush boundary kills the kernel.

**Mechanism-derived unseen prediction.** A trace surface can have fixed total work yet still violate prefix closure when an intermediate event, status, or payload length depends on a private result before approval. The checker should either find such a witness in a production path not used to derive it or certify all declared trace projections under the frozen finite model.

**Publishable threshold.** Exact theorem/proof, independent checker, exhaustive enumeration, strongest matched controls, and either a previously unseen production witness plus correction or a reusable enforcement mechanism with an adversarial prediction.

**Project-consequence threshold.** Hush gains a fail-closed trace-contract verifier that rejects any approval/runtime handler whose declared public trace does not factor through the authorized release at every public prefix.

**Kill condition.** Kill after three substantive runs without a new witness, stronger enforcement mechanism, or materially broader certified runtime boundary. Do not label the classical fiber theorem itself a breakthrough.

## Provenance

The MCP exactly-once terminal lifecycle and bounded-choose fixed-work correction remain preserved on their original branches. No external privacy/task holdout is opened. All finite worlds, projections, and gates are frozen before the first execution.

## Exact prefix-law enumeration freeze

Before executing the reusable checker, exhaust every pair of binary authorized-event and public-observable schedules for `n in {2,3}` private worlds and `T in {1,2,3}` event times. This is `sum 2^(2*n*T) = 270,672` schedule pairs. Record final-fiber closure, prefix closure, and the strict gap where eventual authorization would make a completed trace appear safe even though an earlier public prefix distinguished worlds that were not yet declassified. The predicted smallest strict witness has two worlds and two event times; no strict witness should exist at one event time.

The independent implementation must recompute every aggregate without importing the production checker. The system gate requires: zero cases where prefix closure passes but final closure fails; no strict witness at `T=1`; at least one strict witness at `T>=2`; a minimal two-world/two-time witness; and rejection of fixed-total-work fixtures whose intermediate status, byte length, event order, multiplicity, or work count varies inside an authorized prefix fiber.
