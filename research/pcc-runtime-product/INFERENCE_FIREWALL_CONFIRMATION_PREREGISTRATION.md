# PCC inference-firewall scheduling confirmation: preregistration

Frozen after identifying the missing receipt gate in the case-512..767 run and before executing any case in this cohort.

## Cohort

- Untouched deterministic case IDs: 768..1023.
- Arms: separate PCC comparisons and bounded PCC bundle.
- All task generation, provider capture, exact-source checks, action behavior, approval counts, and replay tests remain unchanged.

## Added machine gates

The benchmark now records, in its discrete evidence and aggregate metrics:

1. whether every PCC constraint receipt declares `inferenceProtection.accounting = realized-partition`; and
2. whether the final posterior after the two comparisons contains exactly 30 candidates.

PASS requires both checks in 256/256 cases for both arms, in addition to all previous utility, disclosure, capacity, approval, and one-shot gates. A full rerun must reproduce the expanded discrete-result digest. Latency remains descriptive.

## Prediction

The identifying pair will remain blocked by the separate correction probe. On this non-identifying scheduling cohort, both PCC arms will complete 256/256 actions, release zero tested exact source values, carry realized-posterior receipts in every case, leave 30 candidates in every final posterior, and retain the bundled approval reduction from 768 to 512.

This is still synthetic product evidence. It does not establish security for non-integer extraction, arbitrary semantic priors, malicious trusted contracts, external models, timing channels, or provider reliability.
