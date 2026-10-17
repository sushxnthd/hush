# PCC inference-firewall first confirmation limitation

The correction probe passed, and the first post-correction scheduling cohort (case IDs 512..767) retained 256/256 task/action success, zero tested exact source matches, 512 bundled approvals, and replay denial. Its result file reports `overall: PASS` under the benchmark's inherited six gates.

However, the correction preregistration also required every PCC receipt to record realized-partition protection and predicted exactly 30 remaining candidates after the two scheduling comparisons. The inherited benchmark collected those receipts but did not score either requirement. Therefore this cohort is **INCONCLUSIVE_PROTOCOL_IMPLEMENTATION**, not confirmatory PASS.

The result remains immutable. The corrective action is to add explicit machine gates for:

1. every PCC constraint receipt carrying `inferenceProtection.accounting = realized-partition`; and
2. the final posterior containing exactly 30 candidates in every case.

Those gates must be frozen before running a different untouched cohort.
