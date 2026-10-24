# Lifecycle absence is an authorization-relevant output

**Classification:** exact finite theorem + prospective production enforcement  
**Status:** PASS  
**Claim scope:** discrete declared lifecycle traces for trusted finite Hush adapters

## Smallest supported claim

Let `W` be a finite hidden-world set and `G:W->A` the transaction-authorized observation. A fixed lifecycle has phases `i=1..k`, activation `a_i(w)`, and payload `p_i(w)` when active. Lift each phase to

`z_i(w)=BOTTOM` if inactive and `z_i(w)=(PRESENT,p_i(w))` otherwise.

The public lifecycle trace `Z=(z_1,...,z_k)` reveals no distinction forbidden by `G` if and only if every lifted phase factors through `G`. Equivalently,

`G(w)=G(w') => Z(w)=Z(w')`.

For arbitrary races/interleavings, event labels and order belong inside `Z`. Missing events are not “nothing”; absence is one value of the observable alphabet.

## Proof

If every coordinate `z_i` is constant on every fiber of `G`, their tuple `Z` is constant on each fiber. Conversely, if `Z` is constant on each fiber, every coordinate projection is constant on each fiber. This is an iff.

The payload-only rule compares `p_i(w)` and `p_i(w')` only when both phases activate. It therefore accepts a pair in which one phase is absent and the other emits a constant payload, while the external traces differ. Hence payload-only safety is strictly weaker whenever activation may depend on a protected distinction.

## Exact falsification of the payload-only baseline

Frozen model: four worlds, parity authorization, one to three phases, and per-phase alphabet `{BOTTOM,0,1}`.

| Quantity | Exact result |
|---|---:|
| Payload-only-safe single-phase maps | 49 |
| Actually safe single-phase maps | 9 |
| Payload-only candidates, 1–3 phases | 120,099 |
| Actually safe candidates | 819 |
| Payload-only false accepts | **119,280** |
| Certificate/oracle disagreements | **0** |

The counts also follow directly. In either two-world parity fiber, the payload-only rule forbids only `(0,1)` and `(1,0)`, leaving seven ordered pairs; two fibers give `7^2=49`. Full trace equality leaves three choices per fiber, giving `3^2=9`. Product phases yield `49^k` and `9^k` respectively.

## Prospective runtime consequences

The protocol froze eight predictions before outcomes. Hush's production `ActionBroker` now supports an opt-in `requireLifecycleTraceCertificate` gate. A trusted adapter declares a complete world-to-canonical-trace map. Hush binds its commitment into the ticket/request hash and rechecks it immediately before credential resolution or dispatch.

| Frozen case | Decision | Credential resolutions | Adapter dispatches |
|---|---:|---:|---:|
| Secret-dependent event existence | deny | 0 | 0 |
| Secret-dependent allow/error terminal | deny | 0 | 0 |
| Secret-dependent cancellation terminal | deny | 0 | 0 |
| Secret-dependent race order | deny | 0 | 0 |
| Secret-dependent crash/restart marker after fresh-process recovery | deny | 0 | 0 |
| Authorization-factored trace | allow | 1 | 1 |
| Missing required declaration | deny | 0 | 0 |
| Legacy opt-out | unchanged request hash; both controls allow | n/a | 2 |

Changing a declaration after approval is also rejected by commitment mismatch before dispatch.

## Verification

- Primary exact enumeration: 120,099 candidate lifecycles.
- Independent Python implementation: 10/10 checks.
- Duplicate primary result: byte-identical.
- Focused and predecessor tests: 19/19.
- Full local regression: 367/367.
- Primary artifact SHA-256: `f2b3391d555bdea3e2ad8532973cd3c2487294d84f18b7c48c36ac25892c5867`.
- Independent audit SHA-256: `51e713828365795c79c860a24f63a36a7f816dd8de287a31162807d45226c2b4`.

## Prior-art boundary

General noninterference, trace equivalence, progress-sensitive information-flow security, and oblivious reactive execution are established foundations. In particular, progress/termination is a known covert channel, reactive traffic shape must be secret-independent, and trace-based hyperproperties compare multiple executions. Relevant starting points include:

- Goguen and Meseguer, *Security Policies and Security Models* (IEEE S&P 1982): https://ieeexplore.ieee.org/document/6234891
- Moore et al., *Precise Enforcement of Progress-Sensitive Security* (CCS 2012): https://doi.org/10.1145/2382196.2382289
- Blaabjerg et al., *OblivIO: Securing Reactive Programs by Oblivious Execution* (2023): https://arxiv.org/abs/2301.08148
- Finkbeiner et al., *Synthesizing Reactive Systems from Hyperproperties* (2019): https://arxiv.org/abs/1905.13511

No novelty is claimed for the tuple-factorization theorem by itself. The defensible Hush contribution is the exact missing-event countermodel space, its transaction-authorization specialization, and the fail-closed pre-dispatch certificate integrated into the real broker and exercised across cancellation, race, and restart traces.

## Threat model and limitations

- The trusted adapter must declare traces truthfully and completely. Hush currently authenticates declaration identity, not semantic truth against arbitrary adapter code.
- The finite trace map covers declared discrete observables. Continuous timing, CPU/cache effects, packet-level traffic, process memory, and dishonest adapters remain outside this certificate.
- Fixed-phase traces encode `BOTTOM` explicitly. Variable/interleaved traces must include labels and order in the canonical sequence.
- This is conditional noninterference relative to `G`, not universal secrecy or differential privacy.
- The new gate is opt-in to preserve existing integrations. A production profile seeking lifecycle protection must require it.

## Reproduction

```bash
node research/pcc-runtime-product/run_lifecycle_absence_factorization.mjs /tmp/result.json
python3 research/pcc-runtime-product/audit_lifecycle_absence_factorization.py /tmp/result.json --output /tmp/audit.json
node --test test/lifecycle-trace-contract.test.js test/lifecycle-trace-enforcement.test.js
```

The pre-outcome syntax failure is retained in `lifecycle_absence_factorization_failed_gate.txt`.
