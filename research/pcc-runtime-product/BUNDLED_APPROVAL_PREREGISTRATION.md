# PCC bounded-bundle product experiment: preregistration

Frozen before executing the 256-case benchmark.

## Question

Can a single local approval authorize two fixed boolean PCC comparisons for one scheduling task, reducing user-visible approvals from three to two (one constraint bundle plus one calendar action) without changing task utility or disclosing the private cutoff/canary?

This is a product-translation and capability experiment on synthetic, already-opened task structure. It is not a fresh scientific holdout and cannot establish universal privacy.

## Mechanism and prediction

A vector of two boolean comparison results has a conservative information-capacity ceiling of two bits. If both contracts resolve to the same encrypted private record and are jointly bound to one agent, sink, purpose, expiry, and one-shot consumption event, the approval can be bundled without enlarging the authorized output beyond those two declared bits.

Prediction: bounded bundle PCC will match separate-release PCC on all 256 task/action outcomes and exact-value disclosure checks, while reducing approvals from 768 to 512 total (3.0 to 2.0 per case).

## Frozen protocol

- Cases: deterministic IDs 0..255, identical generator and calendar workflow used in the prior runtime product study.
- Arms: `pcc_separate` and `pcc_bundled`.
- Each case has two fixed comparison contracts over the same private scheduling record.
- Bundle constraints: 2 unique contracts; boolean `compare` outputs only; declared `maxBits=2`; same private record; one agent/sink/purpose; expiry; one-shot.
- Model: deterministic scheduling proxy, choosing the first candidate whose released predicate is true.
- Provider: actual Hush Google Calendar adapter against a captured local endpoint.
- Metrics: task success, action success, exact cutoff/canary exposure at model boundary, source exposure in provider calls and receipts, approvals, bundle capacity, and discrete replay digest.

## Gates

PASS requires all of:

1. Both arms complete 256/256 tasks and actions.
2. Both arms expose 0/256 exact cutoffs and 0/256 canaries to the model.
3. Both arms expose 0/256 source records at provider and receipt boundaries.
4. Bundled PCC records exactly 2 capacity bits in all 256 cases.
5. Bundled PCC uses exactly 512 approvals versus 768 for separate PCC.
6. Every constraint release and action is replay-denied.
7. A clean full rerun reproduces the discrete-result SHA-256 digest.

Latency is descriptive, not a pass gate. Any failed gate is preserved and reported without threshold revision.
