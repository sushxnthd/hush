# Matched-output trace enforcement: preregistration

Date frozen: 2026-10-16

## Active kernel

**Precise question.** Under an identical intended public output channel, can a Hush-style mediated monitor reject executions containing unauthorized reads or tool actions that no verifier observing only the intended output can distinguish from an authorized execution?

**Best-known frontier.** Reference monitors and execution monitors enforce safety properties from event traces. Output-only noninterference or semantic declassification instead constrains what becomes public. The earlier Hush PCC privacy-utility advantage was exactly contained by an output-complete semantic declassifier, so this kernel tests only an operational enforcement separation; it does not attribute the separation to PCC syntax.

**Exact objective.** In the finite model below, establish an indistinguishability lower bound for output-only admission and an exact monitor for trace safety; then implement the monitor as a pre-dispatch Hush API with hash-bound receipts.

**Strongest alternative explanation.** The result is merely the consequence of giving Hush more observations. A matched semantic verifier instrumented with the full internal trace should equal the Hush monitor exactly. If it does, the supported consequence is architectural mediation, not superiority of compilers, PCC, or a particular policy language.

**Cheapest decisive falsification.** Exhaust all policies, intended outputs, and read/action incidence traces for up to four resources and three actions. Search for either (a) a sound-and-complete output-only verifier, (b) a Hush monitor misclassification, (c) disagreement between Hush and the full-trace semantic control, or (d) an unsafe event that reaches the supplied effect callback.

**Publishable success condition.** An exact theorem plus exhaustive finite audit and a runtime mechanism showing: output-only admission cannot be both sound and complete whenever one output has both a safe and unsafe realization; a trace monitor is sound and complete for the safety policy; the trace-aware semantic control is identical; and denied events never dispatch.

**Project-relevance threshold.** The result must change Hush's runtime contract: access/action assurance requires complete mediation of internal events and receipts bound to the attempted event sequence. A final-output receipt alone is insufficient.

**Kill condition.** Kill or reformulate if the full-trace semantic control differs from Hush, if any unauthorized callback executes, if receipt verification misses tampering, or if the lower bound requires assumptions absent from the implemented mechanism.

## Frozen finite model

A policy is a pair of allowed sets `(R_allow, A_allow)`. A candidate execution has an internal incidence trace `(R_seen, A_seen)` and one intended public output `y` in `{0,1}`. It is safe exactly when `R_seen` is a subset of `R_allow` and `A_seen` is a subset of `A_allow`.

An output-only admission verifier is any Boolean function of `y`. A full-trace verifier additionally observes the policy and internal incidence trace. A Hush monitor observes each read/action before its effect is dispatched. Public release events carry output values but do not authorize prior internal events.

The exhaustive audit covers every policy, trace, and output for `|R| = 1..4` and `|A| = 1..3`, plus every one of the four Boolean output-only verifiers. No frozen holdout is opened by this test.

## Frozen gates

1. For every policy/output fiber containing safe and unsafe traces, accepting one safe trace forces an output-only verifier to accept an unsafe trace with the same output.
2. No output-only verifier is both sound and complete on the full domain.
3. The incremental monitor exactly matches the set-inclusion safety predicate on all enumerated traces.
4. The full-trace semantic control exactly matches the monitor on all enumerated traces.
5. In runtime tests, an unauthorized event never invokes its effect callback; an authorized event invokes it exactly once.
6. Every receipt chain verifies before tampering and fails after event, decision, or predecessor-hash tampering.
7. An independent implementation reproduces the exact counts and all gate decisions.

## Ledgers at freeze

### SCIENCE

- Hypothesis: output equivalence is insufficient for access/action compliance; complete mediation supplies exactly the missing observable.
- Null/alternative: once both methods see the same full trace, no semantic-vs-Hush distinction remains.
- Novelty posture: no historical novelty is claimed for the generic reference-monitor lower bound. Any defensible contribution must be the exact Hush runtime contract, audit, and mechanism consequence.

### CONSEQUENCE

- If the gates pass, Hush must expose a pre-dispatch trace monitor and hash-bind receipts to all attempted mediated events.
- UI or documentation must not describe final-output equivalence as evidence that internal access/action policy was obeyed.
- If a tool path bypasses the monitor, the assurance claim is false for that path.
