# PCC bounded-bundle correction: preregistration

Frozen after diagnosing the first-run receipt collision and before executing any case in the new 256-case cohort.

## Prior failure and fixed correction

The first run's only failed gate was caused by public `outputBytes: 203` colliding numerically with case 83's private cutoff of 203. Although the byte count was constant and therefore did not encode that cutoff in this task family, public output size is unnecessary and can be a side channel when serialized lengths vary.

The sole runtime correction is to omit `outputBytes` from bundle preparation metadata and the bundle receipt. Internal byte accounting remains available to the kernel but is not released. The benchmark adds a frozen `case_start` parameter; all other task, baseline, metric, and gate definitions are unchanged.

## Untouched cohort and prediction

- Cohort: case IDs 256..511 (`case_start=256`), never executed by the first run or its diagnosis.
- Prediction: both arms retain 256/256 task/action success, zero exact source matches at model/provider/receipt boundaries, 256/256 two-bit accounting, and 256/256 replay denial.
- Product prediction: bundled PCC uses 512 approvals versus 768 for separate PCC, a one-third reduction.
- Overall PASS requires every original gate to pass without reinterpretation.

This remains a synthetic product-translation study with a deterministic model proxy and simulated provider endpoint. It does not establish universal, semantic, side-channel, or adversarial privacy.
