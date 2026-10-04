# Supakeep synthetic privacy benchmark

These are **synthetic engineering benchmarks**, not claims about Charlie, 1Password, Arcade, Permit, Outerlimit, or any other competitor. They test whether Supakeep's own disclosure-budget invariants behave as intended.

## Adversarial cumulative-disclosure simulation

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

The point of this test is not that “0%” represents real-world privacy safety. The threshold and privacy-cost scale are synthetic. The useful result is that the implementation enforces the designed invariant: **many individually acceptable disclosures cannot accumulate without eventually triggering ASK/DENY.**

## Benign utility simulation

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

This is a deliberately simple utility smoke test. Real product validation must measure task success, user comprehension, approval fatigue, and privacy leakage on real agent traces.

## Next benchmark upgrades

1. Import real MCP traces from multiple agents.
2. Add adaptive multi-turn inference attacks.
3. Add colluding-sink scenarios.
4. Measure privacy vs task-success Pareto curves rather than one threshold.
5. Add benchmark adapters for public privacy-agent datasets.
6. Red-team prompt injection that attempts to manipulate privacy categories or trust state.
7. Measure latency overhead at the gateway.
