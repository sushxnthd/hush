# Hush PCC: HAA evidence brief

## One-sentence claim

Hush can complete the tested private scheduling decisions through its real
encrypted runtime and approval-bound calendar action path without sending the
exact private scheduling cutoff or unrelated private note to the model, while
raw context and exact semantic minimization disclose more private information.

## Why this matters

Personal AI normally faces a blunt choice: give the model enough private
context to act, or redact that context and lose utility. Private Constraint
Compilation (PCC) tests a third architecture: compute the task-sufficient fact
locally, disclose only a bounded result, then broker the approved action.

## Evidence ladder

1. **Prospective external benchmark foothold.** On the untouched POLAR P2
   subset, PCC v2 achieved utility 1.000 and privacy 1.000 across 1,570 cases,
   with 0/11,366 protected exact-value disclosures versus 11,366/11,366 for raw
   context. This is scoped structured-context evidence, not universal privacy.
2. **Clean-room replication.** A standard-library Python implementation that
   imports neither Hush's JavaScript compiler nor its evaluators matched a
   separate oracle on 114,688/114,688 exhaustive cases with zero protected
   canary disclosures.
3. **Failure preserved.** The first frozen clean-room version failed because
   digits in an unrelated canary confused a global numeric extractor. This
   falsified “type alone is sufficient”; the corrected prediction requires
   extraction to be bound to a trusted field or anchor.
4. **Composition boundary.** Unbudgeted boolean predicates reconstructed all
   4,096 tested secrets. A five-bit cumulative guard reconstructed none and
   retained at least 128 possible values in every case.
5. **Actual Hush product path.** Across 256 cases per arm, PCC exercised the
   encrypted ContextKernel, typed contracts, explicit consent, one-shot release,
   action broker, Calendar adapter, captured provider payload, and receipts.

## Decisive product result

| Arm | Completed action | Exact cutoff at model | Canary at model |
|---|---:|---:|---:|
| Raw context | 256/256 | 256/256 | 256/256 |
| Exact semantic minimization | 256/256 | 256/256 | 0/256 |
| Strict redaction | 0/256 | 0/256 | 0/256 |
| **Hush PCC** | **256/256** | **0/256** | **0/256** |

No arm sent a source field to the Calendar provider. PCC receipts contained no
exact source field. A full rerun reproduced the discrete outcome digest exactly:
`98735b9f6dbe1c819e6701b6ed2f0000614bc89e9a1ab2693c4d12eaaca3ac9a`.

## What I learned by trying to falsify it

- Naive typed extraction fails when unrelated text contains same-type values.
- Exact semantic minimization can preserve utility while still disclosing the
  private value the task depends on.
- Strict redaction protects privacy but can destroy the action capability.
- One-bit answers are not automatically safe under repetition; composition must
  be budgeted across the task trajectory.
- PCC's current privacy/utility advantage costs two extra approvals and roughly
  150–271 ms in a conservative fresh-kernel microbenchmark. Approval bundling is
  now a product research target, not a hidden limitation.

## Honest boundary

The runtime experiment is deterministic and synthetic, uses a model proxy, and
simulates Google's remote endpoint. It does not establish semantic privacy,
side-channel safety, live-provider reliability, named-competitor superiority,
third-party reproduction, or universal privacy. The scientific breakthrough
gate remains **INCONCLUSIVE** pending fresh external model-based evaluation and
prior-art/independent review.

## Reproduce

```bash
python3 research/pcc-cleanroom/run_experiment.py \
  --output research/pcc-cleanroom/results_v2.json
node research/pcc-runtime-product/run_benchmark.mjs \
  --output research/pcc-runtime-product/results.json
npm test
```

Public review package: https://github.com/sushxnthd/hush/pull/35

## Next experiment

Bundle the two PCC predicates under one disclosure-budget-preserving task
approval, then freeze an external scheduling set and pinned local model. Capture
model, MCP, provider, error, retry, timing, and receipt traces, and score exact
plus semantic/inference leakage against raw and exact semantic-minimization
controls.

