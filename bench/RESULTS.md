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

Observed results:

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

The output-cardinality bound remains useful as a conservative transcript mechanism for interfaces without a declared finite-domain model. It is **not** a pointwise measure of how informative the realized branch was.

## 5. Cross-trajectory reconstruction

The attacker starts a fresh trajectory for every adaptive query.

| Policy | Answers released | First denial | Exact recovery? | Candidates remaining |
|---|---:|---:|---:|---:|
| No persistent firewall | 20 | — | Yes | 1 |
| Persistent firewall, same sink | 6 | 7 | No | 15,625 |
| Persistent firewall, rotating sinks | 8 | 9 | No | 3,906 |

This closes the specific task-reset / sink-rotation attack exercised by the benchmark.

## 6. Partition-aware realized leakage

This benchmark targets a weakness in cardinality-only accounting.

For a secret uniformly modeled over `0..999999`, consider:

```text
secret == 734219 ?
```

The interface has only two possible outputs, so cardinality-only accounting assigns **1 nominal bit**. If the realized answer is `true`, however, the feasible state collapses from 1,000,000 candidates to one:

```text
log2(1,000,000 / 1) = 19.931569 bits
```

Observed results:

| Attack / branch | Result |
|---|---:|
| Nominal capacity of exact-match predicate | 1 bit |
| Realized knowledge if exact match is true | **19.931569 bits** |
| Partition-aware decision | **DENY before release** |
| Candidates after forbidden branch | 1 |
| False equality probes safely released | **1,000** |
| Knowledge accumulated by those false probes | **0.001443 bits** |
| Balanced binary refinements released | **8** |
| Next balanced refinement | **DENY at 9** |
| Candidates remaining | **3,906** |

This shows two desirable behaviors simultaneously:

1. **rare high-information branches are stopped even when their output alphabet is tiny**, and
2. **low-information branches are not overcharged merely because they are boolean**.

The mechanism tracks the remaining feasible partition, so semantically redundant predicates add zero realized knowledge even if written differently.

The integrated v0.7 runtime applies this pre-release check to declared finite integer domains for predicate and bucket programs. The state is encrypted and restored across process restarts. Native MCP tests verify that a forbidden rare result is denied without returning the result to the AI client.

## Reproducibility

All tests and benchmarks run in GitHub CI:

```bash
npm test
npm run bench
npm run check
```

The current v0.7 suite contains **78 passing automated tests** plus six benchmark programs.

## Current boundary and next benchmark upgrades

Partition-aware accounting is a finite-domain explicit-output experiment, not a universal privacy proof. Current open research includes:

1. multi-field `choose` programs where one selected candidate jointly constrains several private fields;
2. categorical, set-valued, continuous and high-dimensional private state;
3. non-uniform priors and posterior-risk metrics beyond uniform feasible-set size;
4. colluding agents and destinations with public auxiliary information;
5. real MCP/client traces from multiple agent stacks;
6. privacy-vs-task-success Pareto curves against strong baselines;
7. prompt injection attempting to manipulate domain metadata or program structure;
8. latency and approval-friction measurements;
9. timing, failure, network and externally observable side channels;
10. real recommendation and action tasks spanning shopping, travel and scheduling.
