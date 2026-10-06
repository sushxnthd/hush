# Hush Research

Hush publishes preregistered tests, frozen external evaluations, negative results, development ablations, and explicit claim boundaries around private computation, reconstruction resistance, and agent authority.

## Current evidence

### Scientific Superiority v1 — preregistered internal synthetic protocol

Across 4,000 paired bounded-personalization tasks, Hush matched the oracle on 100% of tasks while exposing 0.000 exact private input attributes. Coarse minimization reached 84.125% oracle agreement while exposing 0.938 exact private attributes per task. The tested adaptive reconstruction setting produced 0% exact recovery under Hush versus 100% for the unprotected control.

### AgentCIBench — frozen external holdout

On the frozen 50-case independent-origin holdout, Hush preserved 95.07% mean completeness while reducing mean exact protected-context violation from 0.9410 to 0.7960 versus the matched semantic-only retriever, a 15.4% relative reduction. Paired leak-free wins were 6–0; frozen p = 0.03125. All eight preregistered scientific gates passed.

### AgentLeak — pinned independent detector

Across 50 paired production-ActionBroker traces, Hush preserved 100% task success with 0% credential-canary leakage; the naive comparator exposed the canary in every trial.

### Lineage-aware context boundary v1f — development only

Across 67 development scenarios, completeness was 0.9701 versus 0.9754 semantic-only while protected-context violation fell from 0.9226 to 0.7712. Paired leak-free outcomes were 7–0; p = 0.015625. This result is development-selected and still requires a fresh untouched confirmation.

## Claim boundaries

The strongest current evidence concerns explicit model-facing output channels under controlled workloads. Timing, compromised hosts, bypass traffic, network metadata, covert channels, and unmediated side effects remain outside the guarantee. The AgentCIBench result still has 79.60% mean protected-context violation, so it is evidence of a statistically significant improvement, not evidence that contextual privacy is solved. Hush has not yet been independently reproduced or proven superior to every named commercial system.

Research directory: https://github.com/sushxnthd/hush/tree/main/research
