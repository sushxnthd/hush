# PCC preparation timing-oracle probe — frozen protocol

## Question

After response metadata and denial control flow are made identical, does
`prepareConstraintRelease()` still expose whether a bounded equality result was
withheld by the realized-posterior firewall through elapsed time?

## Competing mechanisms

- **H1 — result-dependent timing:** the withheld and allowed internal
  transactions serialize different private state or take different firewall
  paths, creating a stable latency difference despite identical public output.
- **H0 — no usable timing signal:** any elapsed-time difference is smaller than
  ordinary same-result runtime drift and cannot classify the private branch at
  the preregistered effect size.

## Frozen design

- Query: `secret == 500`; declared integer domain: `0..1023`.
- Target worlds: `secret=500` (withheld) and `secret=501` (allowed).
- Null-control worlds: `secret=501` and `secret=502` (both allowed).
- Four real `ContextKernel` instances, each with its own encrypted temporary
  store. Kernel construction is outside the timed interval.
- 25 untimed warm-ups per world, followed by 500 target pairs and 500 null
  pairs. Target and null pairs alternate. Within-pair order is randomized by a
  fixed seeded generator (`0x5eed1234`).
- Only the synchronous `prepareConstraintRelease()` call is timed with
  `process.hrtime.bigint()`. No release is approved or consumed.
- All raw pair timings are preserved. No outlier deletion or post-hoc trimming.

## Frozen analysis

For every pair compute the log latency ratio in canonical world order. Pair the
target and null-control log ratios by index and define adjusted differences as
`target_log_ratio - null_log_ratio`.

The probe reports a timing-oracle **FAIL** only if all gates hold:

1. the absolute adjusted median corresponds to at least a 5% latency ratio;
2. at least 65% of adjusted pairs have the same non-zero direction as the
   median;
3. a two-sided exact sign-test p-value is below 0.001; and
4. the same direction holds in at least 4 of 5 consecutive 100-pair blocks.

Otherwise the result is **PASS WITHIN TESTED RESOLUTION**, never a proof of
constant-time execution.

## Claim boundary

This measures an in-process elapsed-time channel on one machine and Node.js
runtime. It does not cover network timing, cache/CPU adversaries, other
predicates or domains, standing prior consent, malicious contracts, or formal
constant-time/noninterference.
