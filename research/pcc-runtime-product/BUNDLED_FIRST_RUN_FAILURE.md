# Bounded PCC bundle: frozen first-run failure

The preregistered 256-case run failed one of six gates. The bundle preserved 256/256 task and action successes, zero model/provider exact source disclosures, two-bit capacity accounting, one-shot behavior, and reduced approvals from 768 to 512. The receipt-boundary gate nevertheless recorded 1/256 exact-value matches.

Opened-data diagnosis localized the sole match to case 83, whose private cutoff was the integer `203`. The bundle's public preparation metadata and receipt independently contained `outputBytes: 203`. The serialized output length was constant for this task family and did not depend on the cutoff, so this was a numeric collision rather than causal recovery of the private cutoff. The frozen detector was intentionally not reinterpreted after outcomes: the first run remains `FAIL`.

The collision exposed a broader hardening opportunity. Output byte counts are unnecessary public metadata and can become a size side channel in tasks where output lengths vary. The corrective design removes `outputBytes` from bundle preparation metadata and receipts, retains it only internally, and reruns on unopened case IDs under a separately frozen correction protocol.
