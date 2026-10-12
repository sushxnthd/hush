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
6. **Usability mechanism.** A prospectively frozen bounded bundle combined two
   boolean PCC releases under a two-bit ceiling. On untouched case IDs 256–511,
   it preserved 256/256 task/action successes and zero tested source disclosures
   while reducing approvals from 768 to 512 (3.0 to 2.0 per action).
7. **Adversarial correction.** Two comparisons initially reconstructed an exact
   value from a 1,024-value domain while PCC reported only two nominal bits. The
   failure was preserved. PCC now uses the shared realized-posterior firewall;
   it denied the identifying pair at 10 bits and retained exactly 30 candidates
   in every case of a new 256-case scheduling cohort.

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
- The first approval-bundle run failed 1/256 receipt checks because public
  `outputBytes: 203` collided with a private cutoff of 203. The failed run was
  preserved; removing unnecessary size metadata eliminated that side-channel
  surface, and the untouched correction cohort passed all six frozen gates.
- Bounded bundling removes one of PCC's two additional approvals. Its roughly
  197 ms fresh-kernel latency remains a product limitation, not a hidden cost.
- A small output alphabet is not a privacy guarantee: rare output preimages can
  reveal far more than `log2(output count)`. PCC comparison receipts now report
  realized-posterior accounting, and stale concurrent preparations fail closed.
- Posterior keys must represent the recovered private scalar, not the syntax of
  its extractor. A harmless anchor alias initially split one secret across two
  ledgers and enabled exact reconstruction. The preserved counterexample now
  fails closed: equivalent extractors share one opaque scalar ledger, conflicting
  domain aliases are rejected.
- Schema paths are not necessarily scalar identities either. A duplicate
  `balance`/`availableBalance` field pair again split the ledger and reconstructed
  the exact value. Scalar-only identity closed the unchanged frozen probe;
  field aliases now share one ledger, conflicting domains fail closed, and the
  full 303-test suite passes. The conservative cost is that unrelated fields
  with equal current values may also share accounting.
- Collision resistance is not secrecy for a small domain. Publishing the
  scalar's raw SHA-256 identifier in the local diagnostic footprint allowed an
  independent enumerator to recover 500 from 1,024 candidates. The failure is
  preserved; public diagnostics now show only `pcc:derived`, retain aggregate
  posterior statistics, and yield zero dictionary matches. The complete suite
  passes 304/304 tests.
- An approval prompt is itself a disclosure boundary. Before correction,
  single-release preparation exposed a private comparison through both its
  realized candidate count (524 versus 500) and serialized size (108 versus
  132 bytes); bundle preparation exposed a result pair through a realized count
  of 300. All results were inferred while the decision remained `ask`, with no
  approval or consumption. Safe metadata now withholds result-dependent size
  and posterior statistics until consumption; the unchanged probe recovers
  0/3 results and the full 304-test suite passes.
- Firewall control flow is also an approval-bound disclosure surface. An
  equality that exceeded the eight-bit posterior limit threw during preparation,
  while the opposite result returned `ask`, revealing the private comparison
  without approval. Preparation now returns the same safe `ask` observation in
  both worlds; after explicit approval, withheld releases become generic,
  one-shot denials with no result or posterior commit. The unchanged probe,
  15/15 focused tests, and the complete 304/304 suite pass.
- A prospectively frozen timing differential then tested whether the corrected
  path retained a large result-dependent latency signal. Across 500 adjusted
  pairs, the median ratio was 1.00052, direction was 251/249, and all four
  leakage gates failed; an independent repeat again failed all gates at ratio
  1.00510. This is a bounded negative result, not a constant-time guarantee.
- Delaying firewall refusal until consumption was still unsafe under standing
  consent: `secret == 500` produced a generic denial while the false world
  released `false`, so the refusal itself revealed the protected bit. The
  preserved frozen failure motivated result-independent feasible-branch
  authorization. The unchanged probe now gives the same pre-consumption denial
  in both worlds, a balanced 512/512 threshold remains usable, a deterministic
  rerun is byte-identical, and the complete suite passes 306/306 tests.
- Hiding each scalar digest still left the number of internal ledgers visible.
  Since equal recovered values co-account, two private fields produced one
  public diagnostic row when equal and two when unequal—an equality oracle with
  zero approvals and consumptions. The preserved failure is corrected by one
  conservative aggregate PCC diagnostic row. The unchanged differential is now
  relation-independent, reruns byte-identically, and 307/307 tests pass.

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
node research/pcc-runtime-product/run_bundled_benchmark.mjs \
  --case-start 768 \
  --output research/pcc-runtime-product/bundled_results_v4.json
node research/pcc-runtime-product/run_extractor_alias_probe.mjs \
  --output /tmp/extractor_alias_replay.json
node research/pcc-runtime-product/run_field_alias_probe.mjs \
  --output /tmp/field_alias_replay.json
node research/pcc-runtime-product/run_digest_dictionary_probe.mjs \
  --output /tmp/digest_dictionary_replay.json
node research/pcc-runtime-product/run_preapproval_metadata_probe.mjs \
  --output /tmp/preapproval_metadata_replay.json
node research/pcc-runtime-product/run_denial_oracle_probe.mjs \
  --output /tmp/denial_oracle_replay.json
node research/pcc-runtime-product/run_timing_oracle_probe.mjs \
  --output /tmp/timing_oracle_replay.json
node research/pcc-runtime-product/run_selective_refusal_probe.mjs \
  --output /tmp/selective_refusal_replay.json
node research/pcc-runtime-product/run_ledger_cardinality_probe.mjs \
  --output /tmp/ledger_cardinality_replay.json
npm test
```

Public review package: https://github.com/sushxnthd/hush/pull/35

## Next experiment

Freeze an external scheduling set and pinned local model, then run the bounded
bundle through captured model, MCP, provider, error, retry, timing, and receipt
traces. Score exact plus semantic/inference leakage against raw and exact
semantic-minimization controls, including adaptive repeated-query attacks.

