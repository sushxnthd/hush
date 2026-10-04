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
| Cardinality-only runtime | **ALLOW `rare-profile`** |
| Exact joint profile identified | **Yes** |
| v0.8 joint guard | **DENY before release** |
| Selected result included in denied response | **No** |
| Common branch posterior | **65,535 profiles** |
| Common branch realized gain | **0.000022014 bits** |
| Common branch | **ALLOW** |

The joint firewall composes prior released `choose` observations across overlapping private-field sets. Allowed informative observations are encrypted with Context Kernel state and survive restart. Repeating a choice whose information is already implied by prior observations adds zero marginal joint knowledge.

The public privacy footprint intentionally omits the selected result, so diagnostics do not re-expose an observation that the privacy mechanism is trying to govern.

The exact v0.8 prototype analyzes joint products up to 100,000 currently feasible states. Larger connected products fail closed rather than falling back to the weaker nominal rule.

## Reproducibility

All tests and benchmarks run in GitHub CI:

```bash
npm test
npm run bench
npm run check
```

The current v0.8 suite contains **84 automated tests** plus **seven benchmark programs**.

## Current boundary and next benchmark upgrades

These are finite-domain explicit-output experiments, not universal privacy proofs. Current open research includes:

1. scalable joint inference beyond explicit Cartesian enumeration;
2. categorical, set-valued, continuous and high-dimensional private state;
3. correlated and non-uniform priors plus posterior-risk metrics beyond support size;
4. adversarial overlapping choice programs on state spaces above the v0.8 exact-analysis limit;
5. colluding agents/destinations with public auxiliary information;
6. real MCP/client traces from multiple agent stacks;
7. privacy-vs-task-success Pareto curves against strong baselines;
8. prompt injection attempting to manipulate privacy metadata or program structure;
9. latency and approval-friction measurements;
10. timing, failure, network and externally observable side channels;
11. real recommendation/action tasks spanning shopping, travel and scheduling.
