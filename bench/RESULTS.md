# Supakeep synthetic privacy benchmarks

These are **synthetic engineering benchmarks**, not claims about any other system. They test whether Supakeep's own invariants behave as intended.

## 1. Adversarial cumulative-disclosure simulation

Configuration:
- 10,000 trajectories
- 18 disclosure attempts per trajectory
- mixed identity, finance, health, relationship, location, work, preference, and general fields
- mixed derived, coarse, and exact disclosure levels
- synthetic leakage threshold: 8 privacy-cost units

Observed results:

| Policy | Trajectories crossing synthetic leakage threshold | Mean automatic exposure |
|---|---:|---:|
| Allow everything | 100.00% | 26.74 |
| Per-call sensitive filter only | 99.93% | 15.99 |
| Supakeep cumulative budget | 0.00% | 3.01 |

The useful result is an implementation invariant: **many individually acceptable disclosures cannot accumulate indefinitely without eventually triggering ASK/DENY.** The threshold and privacy-cost scale are synthetic and do not establish real-world privacy safety.

## 2. Benign utility simulation

Configuration:
- 10,000 trajectories
- 6 low-risk disclosure steps per task
- standard-trust assistant
- general, preference, work, and coarse-location context
- derived/coarse disclosures only

Observed results:
- automatic ALLOW decisions: **99.85%**
- ASK decisions: **0.15%**
- DENY decisions: **0.00%**
- tasks completing with no approval interruption: **99.14%**

This is a deliberately simple utility smoke test. Real product validation must measure actual task success, user comprehension, approval fatigue, and privacy leakage on real traces.

## 3. Adaptive predicate reconstruction

A hidden integer is selected from `0..999999`. An adversarial caller receives a greater-than predicate and performs adaptive binary search.

| Policy | Exact value recovered? | Queries before stop | Candidates remaining |
|---|---:|---:|---:|
| Unrestricted predicate oracle | Yes | 20 | 1 |
| Naive per-field boolean accounting | Yes | 20 | 1 |
| Supakeep trajectory accounting | **No** | **6** | **31,250** |

This demonstrates query-composition behavior only; it is not a universal inference-privacy guarantee.

## 4. Blind personalization / Private Decision Programs

The agent supplies **15 public flight candidates**. Supakeep locally evaluates them using three private fields: travel budget, preferred airline and preferred departure time.

Observed result:

- selected candidate: `flight-08`
- raw private values returned: **0**
- explicit output cardinality: **16**
- conservative explicit-channel capacity bound: **4 bits**
- a second distinct 4-bit decision in the same trajectory: **DENY**

The output-cardinality bound remains useful as a conservative transcript mechanism for interfaces without an analyzable finite-domain model. It is **not** a pointwise measure of how informative the realized branch was.

## 5. Cross-trajectory reconstruction

The attacker starts a fresh trajectory for every adaptive query.

| Policy | Answers released | First denial | Exact recovery? | Candidates remaining |
|---|---:|---:|---:|---:|
| No persistent firewall | 20 | — | Yes | 1 |
| Persistent firewall, same sink | 6 | 7 | No | 15,625 |
| Persistent firewall, rotating sinks | 8 | 9 | No | 3,906 |

This closes the specific task-reset / sink-rotation attack exercised by the benchmark.

## 6. Partition-aware realized leakage

For a secret uniformly modeled over `0..999999`, consider `secret == 734219`. The interface has only two possible outputs, so cardinality-only accounting assigns **1 nominal bit**. If the realized answer is `true`, the feasible state collapses from 1,000,000 candidates to one:

```text
log2(1,000,000 / 1) = 19.931569 bits
```

| Attack / branch | Result |
|---|---:|
| Nominal capacity of exact-match predicate | 1 bit |
| Realized knowledge if exact match is true | **19.931569 bits** |
| Partition-aware decision | **DENY before release** |
| False equality probes safely released | **1,000** |
| Knowledge accumulated by those false probes | **0.001443 bits** |
| Balanced binary refinements released | **8** |
| Next balanced refinement | **DENY at 9** |
| Candidates remaining | **3,906** |

The mechanism tracks the remaining feasible partition, so semantically redundant predicates add zero realized knowledge even if written differently. Its encrypted state is restored across process restarts.

## 7. Malicious candidate-set joint reconstruction

This benchmark tests whether an adversarial recommender can turn the winning candidate itself into a probe of multiple private fields.

Configuration:

- 16 binary private fields;
- 65,536 possible joint profiles;
- two public candidates;
- weighted `matchPrivate` preferences plus a public bias term;
- the rare candidate wins for exactly one of the 65,536 profiles.

Although the interface has only three possible outputs (two ids plus `null`), the rare result uniquely identifies the full synthetic 16-bit profile.

| Condition | Result |
|---|---:|
| Explicit output cardinality | 3 |
| Nominal cardinality charge | **1.584963 bits** |
| Realized rare-branch knowledge | **16 bits** |
| Cardinality-only runtime | **ALLOW rare winner** |
| Exact joint profile identified | **Yes** |
| Joint guard | **DENY before release** |
| Selected result included in denied response | **No** |
| Common branch posterior | **65,535 profiles** |
| Common branch realized gain | **0.000022014 bits** |
| Common branch | **ALLOW** |

The joint firewall composes prior released `choose` observations across overlapping private-field sets. Allowed informative observations are encrypted with Context Kernel state and survive restart. Repeating a choice whose information is already implied by prior observations adds zero marginal joint knowledge.

The public privacy footprint intentionally omits the selected result, so diagnostics do not re-expose an observation that the privacy mechanism is trying to govern.

## 8. Scalable symbolic joint-choice analysis

v0.9 replaces the old hard 100,000-state enumeration boundary with an exact symbolic interval branch-and-bound path for the currently modeled `choose` semantics.

The stress benchmark uses **32 private binary fields**, producing:

```text
2^32 = 4,294,967,296
```

possible joint profiles. Two public candidates are constructed so the rare winner occurs for exactly one profile.

Observed CI invariants:

| Condition | Result |
|---|---:|
| Joint private states | **4,294,967,296** |
| Public candidates | 2 |
| Rare winner posterior | **1 profile** |
| Rare winner realized knowledge | **32 bits** |
| Rare winner | **DENY before release** |
| Analysis method | **symbolic branch-and-bound** |
| Common winner posterior | **4,294,967,295 profiles** |
| Common winner | **ALLOW** |
| Tiny nonzero common-branch leakage persisted internally | **Yes** |

The same symbolic counter also resolves a one-million-value threshold choice by splitting only ambiguous regions. Unsupported or excessively expensive programs are not guessed: once the symbolic work budget is exhausted, the guard falls back to bounded exact enumeration only when the state space is small enough; otherwise it withholds the result.

Internal accounting preserves full floating-point precision even when public telemetry rounds a sub-nanobit marginal gain to `0.000000000`. This prevents display rounding from becoming an accounting reset.

## Reproducibility

All tests and benchmarks run in GitHub CI:

```bash
npm test
npm run bench
npm run check
```

The current v0.9 suite contains **98 automated tests** plus **eight benchmark programs**.

## Current boundary and next benchmark upgrades

These are finite-domain explicit-output experiments, not universal privacy proofs. Current open research includes:

1. categorical, set-valued, continuous and genuinely high-dimensional private state beyond the current integer-domain abstraction;
2. correlated and non-uniform priors plus posterior-risk metrics beyond support size;
3. richer `choose` semantics that cannot yet be tightly bounded by the symbolic analyzer;
4. adversarial programs designed specifically to exhaust symbolic analysis budgets;
5. composition between predicate/bucket leakage, joint-choice leakage and real-world action outcomes in one unified posterior model;
6. colluding agents/destinations with public auxiliary information;
7. real MCP/client traces from multiple agent stacks;
8. privacy-vs-task-success Pareto curves against strong baselines;
9. prompt injection attempting to manipulate privacy metadata or program structure;
10. timing, failure, network and externally observable side channels;
11. real recommendation/action tasks spanning shopping, travel and scheduling.
