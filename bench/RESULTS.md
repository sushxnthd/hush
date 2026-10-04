# Supakeep synthetic privacy benchmarks

These are **synthetic engineering benchmarks**, not claims about Charlie, 1Password, Arcade, Permit, Outerlimit, OCELOT, MINIM, FLOWSEAL, or any other system. They test whether Supakeep's own invariants behave as intended.

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

The naive baseline fails because every changed threshold still appears to be the same already-accounted boolean field. Supakeep treats distinct predicates as new disclosures within one runtime-minted task trajectory.

This demonstrates query-composition behavior only; it is not a universal inference-privacy guarantee.

## 4. Blind personalization / Private Decision Programs

The agent supplies **15 public flight candidates**. Supakeep locally evaluates them using three private fields:

- travel budget
- preferred airline
- preferred departure time

The private values are not returned. The runtime returns one candidate ID or `null`, giving exactly 16 possible explicit outputs.

Observed result:

- selected candidate: `flight-08`
- raw private values returned: **0**
- explicit output cardinality: **16**
- conservative explicit-channel capacity bound: **4 bits**
- trajectory information budget: **4 bits**
- a second distinct 4-bit decision in the same trajectory: **DENY**

The bound follows from the finite output interface: if an explicit result `Y` can take values in a set `Ω`, then `I(S;Y) <= H(Y) <= log2(|Ω|)`. Across adaptive calls, the chain rule gives the conservative transcript bound `I(S;Y1..Yn) <= Σ log2(|Ωi|)`, provided all relevant explicit outputs pass through the controlled interface.

This is **not a claim of total leakage <= 4 bits**. The prototype bound excludes timing, crashes, external side effects, covert channels, and any data released outside Supakeep. It is specifically a bound on the controlled explicit return channel.

## Reproducibility

All tests and benchmarks run in GitHub CI:

```bash
npm test
npm run bench
```

The current suite contains 51 passing tests plus the four benchmark programs above.

## Next benchmark upgrades

1. Real MCP/A2A traces from multiple agents and providers.
2. Colluding-agent and colluding-sink attacks.
3. Sink aliasing and destination canonicalization attacks.
4. Logically equivalent programs written in different forms.
5. High-cardinality membership/set attacks.
6. Privacy-vs-task-success Pareto curves against strong baselines.
7. Prompt injection attempting to manipulate privacy metadata or program structure.
8. Latency and approval-friction measurements.
9. Side-channel analysis for timing, failures, and externally observable effects.
10. Blind-personalization benchmarks on shopping, travel, scheduling, and other real recommendation tasks.
