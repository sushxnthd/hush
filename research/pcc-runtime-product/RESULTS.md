# PCC runtime scheduling product-translation result

Status: **product-translation PASS; scientific breakthrough gate INCONCLUSIVE**.

## Provenance

- Repository base: `f8511cd55018fe845c3d4ad886ba03d9dc9097b2`
- Frozen protocol and benchmark: `b51dfa7f8bfbd6270dac80dd7a58d67fbdeae9ba`
- Runtime: Node.js `v24.19.0`
- Cases: 256 per arm, 1,024 arm-case executions
- Primary result SHA-256: `3bfd1fa6371d46c3b0a5e76c8dd7cdb9b6cf65e070f034f9f03fea663fe8bf56`
- Discrete-outcome SHA-256, run 1 and run 2:
  `98735b9f6dbe1c819e6701b6ed2f0000614bc89e9a1ab2693c4d12eaaca3ac9a`

The second complete execution reproduced the discrete digest exactly. Latency
was intentionally excluded from that digest because it is environment-sensitive.

## Decisive table

| Arm | Task + calendar action success | Exact cutoff at model boundary | Protected canary at model boundary | Source fields at provider boundary | Approvals per successful case |
|---|---:|---:|---:|---:|---:|
| Raw context | 256/256 | 256/256 | 256/256 | 0/256 | 1 |
| Semantic exact minimization | 256/256 | 256/256 | 0/256 | 0/256 | 1 |
| Strict Hush redaction | 0/256 | 0/256 | 0/256 | 0/256 | n/a |
| **PCC through Hush runtime** | **256/256** | **0/256** | **0/256** | **0/256** | **3** |

Every one of the eight frozen gates passed.

## What was actually exercised

This is not a string-filter proxy. Each PCC case created encrypted local Hush
state, registered two typed comparison contracts, prepared approval-gated
releases, approved and consumed each release once, gave only the two booleans
to the deterministic scheduler, requested a Calendar action, approved it,
executed the repository's Google Calendar adapter, captured its outbound HTTP
payload, checked the safe receipt, and verified replay denial.

The Google endpoint was simulated, but the Hush ContextKernel, sanitizer,
consent/release machinery, ActionBroker, Calendar normalization, HTTP request
construction, and one-shot receipts were the production repository code.

## Supported product claim

For the tested threshold-based scheduling class, Hush can choose and create an
acceptable public calendar slot using locally computed eligibility predicates
without sending the exact private availability cutoff or unrelated private
note to the model boundary. Raw context and exact semantic minimization matched
the utility but disclosed more private information; strict redaction withheld
the information but could not complete the task.

This is the first result in this track where the privacy-utility difference is
visible across the actual Hush model/action/provider interfaces rather than
only inside a standalone evaluator.

## Cost and friction

PCC required three approvals per successful case: two bounded releases and one
provider action, versus one provider-action approval for raw and semantic-exact
arms. The first-run mean PCC wall time was 270.6 ms per case versus 2.53 ms for
raw; the warm rerun mean was 149.5 ms versus 1.35 ms. These measurements include
creating and encrypting a fresh ContextKernel for every PCC case and therefore
are conservative microbenchmark overheads, not production latency estimates.

The additional approval burden is a real product bottleneck. A production
workflow should bundle the two candidate predicates under one user-visible task
approval without increasing the disclosure budget.

## Limitations

- The 256 cases are deterministic synthetic cases, not an external holdout.
- The scheduler is a deterministic model proxy; no live model was called.
- Google's remote endpoint was simulated, so network and provider failure modes
  remain untested.
- Exact-field non-disclosure is not semantic or inference privacy. The released
  booleans and selected provider action intentionally reveal bounded facts.
- Timing, error, retry, payload-length, collusion, and operating-system side
  channels were not evaluated.
- The semantic-exact arm is a strong task-specific minimization control, but not
  a named commercial competitor.
- This does not establish third-party reproduction or historical novelty.

## Reproduce

```bash
node research/pcc-runtime-product/run_benchmark.mjs \
  --output research/pcc-runtime-product/results.json
```

Run it twice and compare `discrete_sha256`. The full repository regression
suite is `npm test`.

## Next decisive action

**DISCRIMINATION / PRODUCT-TRANSLATION:** freeze an external scheduling task set
and replace the deterministic scheduler with a pinned local model while keeping
the same captured model, MCP, provider, error, retry, and receipt boundaries.
Add a bundled-task-approval PCC arm. The prospective prediction is that bundled
PCC retains at least 95% of raw-context task success, eliminates exact source
fields at the model boundary, and reduces user-visible approvals from three to
two without increasing the cumulative information budget.

