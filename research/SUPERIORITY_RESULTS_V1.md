# Hush Scientific Superiority Evaluation v1 — Results

**Protocol:** [`SUPERIORITY_PROTOCOL_V1.md`](./SUPERIORITY_PROTOCOL_V1.md)  
**Evaluation commit:** `21b6271e3ff5c0c0096192dd8dd184a1423d943b`  
**CI run:** GitHub Actions `37272400611`  
**Environment:** Ubuntu 24.04, Node.js 22.23.3  
**Outcome:** all pre-specified gates passed.

## Primary privacy–utility experiment

The evaluation ran **4,000 paired bounded-personalization tasks** across four task families (travel, shopping, scheduling and job selection), 20 deterministic seeds and 50 profiles per family per seed.

| Method | Oracle agreement | Exact private input attributes exposed per task |
| --- | ---: | ---: |
| Raw exact context | 100.000% | 2.000 |
| Governed exact retrieval | 100.000% | 2.000 |
| Coarse minimization | 84.125% | 0.938 |
| **Hush bounded computation** | **100.000%** | **0.000** |

On the paired Hush-vs-coarse comparison:

- Hush correct / coarse incorrect: **635** tasks;
- coarse correct / Hush incorrect: **0** tasks;
- exact one-sided paired sign/binomial probability under equal discordant outcomes: **7.01 × 10^-192**.

The preferred semantic agent surface was separately seeded with a private numeric sentinel and a private internal path. **Neither appeared in the caller-visible response.**

Observed decision-runtime latency in this synthetic in-process benchmark:

- median: **0.086 ms**;
- p95: **0.240 ms**.

These timings are mechanism overhead only. They do not include model inference, network calls, connector retrieval, UI latency or production process boundaries.

## Adaptive reconstruction experiment

Each condition used **512 independently generated 16-bit secrets**. The attacker performed adaptive binary-search-style predicates while rotating equivalent predicate syntax, agents, sinks, purposes and trajectories. The revision-reset condition additionally rewrote the same private value before every query.

| Condition | Exact recovery | Wilson 95% CI | Mean answers released | Mean candidates remaining |
| --- | ---: | ---: | ---: | ---: |
| Unprotected identical query semantics | **100%** | 99.26–100.00% | 16.00 | 1.0 |
| **Hush, identity/sink rotation** | **0%** | 0.00–0.74% | 8.00 | 256.0 |
| **Hush, profile-revision reset attempt** | **0%** | 0.00–0.74% | 6.54 | 1,769.3 |

## Pre-specified gates

All eight gates passed:

1. utility-equivalence lower confidence bound ≥ 99.5%;
2. zero exact private inputs on the Hush path and no seeded private marker/path on the semantic agent surface;
3. statistically significant utility advantage over coarse minimization;
4. identical utility with lower exact-private-input exposure than raw context;
5. identical utility with lower exact-private-input exposure than governed exact retrieval;
6. the unprotected control reconstructs the secret;
7. Hush resists identity/sink/trajectory rotation;
8. Hush resists the tested profile-revision reset attack.

## What this result establishes

It is now accurate to say:

> **Under the preregistered Hush Scientific Superiority Protocol v1, Hush is reproducibly superior to the implemented raw-context, exact-retrieval and coarse-minimization baselines on the measured privacy–utility criteria, and prevents the tested adaptive reconstruction attacks that fully recover secrets through the unprotected interface.**

This is a stronger result than feature parity or an anecdotal demo. The benchmark is deterministic, CI-gated, statistically evaluated and has explicit failure thresholds.

## What this result does *not* establish

It is **not yet accurate** to say that Hush has been scientifically proven superior to Charlie, OCELOT, AgentLeak defenses, or every competing product. That stronger claim requires a direct same-workload evaluation of the named systems (where technically possible) and independent reproduction.

Limitations include:

- the task families are synthetic and exactly representable by the Hush decision language;
- utility is candidate-selection agreement, not open-ended generative answer quality;
- the coarse baseline is an abstract minimization strategy, not a commercial system;
- the attack is a strong adaptive threshold family but not an exhaustive attack generator;
- timing, traffic, process-memory and compromised-host side channels are outside this experiment;
- the authors of Hush designed and ran this benchmark.

## External-validation bar

A named-competitor or broadly scientific superiority claim remains gated on:

1. an externally originated benchmark such as AgentLeak / AgentDojo / ConfAIde where applicable;
2. direct comparator configurations on identical workloads;
3. pre-registered endpoints before final runs;
4. paired statistical analysis with all failures retained;
5. independent reproduction or external review.

The dedicated `research-superiority` GitHub Actions workflow emits the complete JSON report, commit SHA, runtime version and SHA-256 checksum as a downloadable artifact so a third party can reproduce the internal Protocol v1 result exactly.
