# Trace-Observable Privacy (TOP)

**Status:** reproducible synthetic prototype, not a production security result.  
**Version:** 1  
**Updated:** 9 October 2026

## Motivation

A privacy boundary can control the text returned to a model while still leaking a private value through the action the model selects. For example, a model could emit the same sentence in every case but call a different recipient, URL, tool, retry path or workflow branch for each secret value.

TOP makes this failure mode explicit by naming the observable sink and measuring the partition induced by the trace visible to that sink. The prototype is deliberately small: it is intended to falsify an over-broad claim before Hush invests in a larger external benchmark.

## Scope and notation

Let:

- (S) be a finite secret domain;
- (s \in S) be the realized private value;
- (T_k(s)) be the complete trace visible to sink (k);
- two secrets be equivalent when they produce the same trace at (k).

The trace partitions (S) into equivalence classes. Under a uniform prior, the exact realized support leakage for secret (s) is:

[
L_k(s) = \log_2 \frac{|S|}{|[s]_{T_k}|}.
]

This is a support-based quantity, not a claim that every real-world prior is uniform. A non-uniform extension must report posterior entropy or min-entropy under an explicitly frozen prior.

The prototype evaluates four sinks/arms:

1. **Naive model-visible action:** the action identifier is present in a tool-call trace visible to the model-facing channel.
2. **Opaque model-visible plan:** the model sees a constant opaque plan; a trusted local executor chooses the private action.
3. **Provider sink:** the provider sees the action selected by the local executor. This is intentionally observable and is not counted as private from that provider.
4. **Denied model-visible action:** Hush denies an action that would encode the secret in a model-visible sink.

## Falsifiable claims

For a finite domain (S):

- If (T_k(s)) is constant over all (s), then every secret is in the same trace class and (L_k(s)=0).
- If (T_k) is injective, then every class has size one and (L_k(s)=\log_2 |S|).
- Moving secret-dependent action selection to a local executor can reduce leakage to the model-visible sink while preserving utility, but it cannot make the provider-side action invisible to a provider that receives it.

The first two statements are direct consequences of the partition definition; they are not presented as a new information-theory theorem. The system contribution under test is the sink-localized execution pattern plus explicit accounting of each observable trace.

## Prototype

Run:

```bash
node bench/trace-observable-privacy.js
node bench/trace-observable-privacy.js --json
```

The benchmark uses a 16-value secret domain (four bits) and four equally valid route actions. Its assertions require:

| Arm | Model-visible leakage | Provider-sink leakage | Utility |
|---|---:|---:|---:|
| Naive action trace | 4 bits | not applicable | 100% |
| Opaque local executor | 0 bits | 4 bits, intentionally observable | 100% |
| Denied model-visible action | 0 bits | not applicable | 0% |

The result is useful only as a mechanism check: it shows that an opaque plan can keep a secret-dependent choice out of one named trace without pretending that the downstream provider cannot observe the action it executes.

## What this does not show

This prototype does **not** establish:

- privacy against the provider sink, network observer, browser, operating system or colluding agents;
- resistance to timing, ordering, retries, failures, payload length, status codes, cache behavior or other side channels;
- safety of arbitrary natural-language plans or untrusted executors;
- security of the current Hush runtime integration;
- performance, usability or user acceptance;
- superiority over a named competitor;
- an independent reproduction or peer-reviewed result.

A production implementation must define the sink set, capture all relevant observables, fail closed for unsupported semantics, and bind the local executor to authenticated policy and auditable receipts. The external validation plan in [SCIENTIFIC_VALIDATION_V2.md](./SCIENTIFIC_VALIDATION_V2.md) is the next step.

## Relation to external research

TOP is motivated by known gaps in output-only privacy evaluation:

- AgentLeak evaluates full-stack leakage across final output, messages, memory and tool pathways: https://arxiv.org/abs/2602.11510
- AgentTell studies behavioral side channels where agent actions reveal a secret: https://arxiv.org/abs/2609.32915
- OCELOT studies inference-time privacy leakage budgets: https://arxiv.org/abs/2505.23684
- AgentDAM evaluates realistic web-agent data minimization: https://arxiv.org/abs/2503.09780

These works motivate the threat model; they do not validate Hush. Hush must still run the frozen external protocols and publish the full trace, configuration and failure accounting.

## Next validation

The minimum credible follow-up is a frozen action-equivalence suite with:

- multiple equally valid actions per task;
- secret-dependent actions separated from task utility;
- model-visible, provider-visible and user-visible trace capture;
- timing, retries, failures and denials recorded as secondary channels;
- paired raw-context and Hush-boundary arms;
- blinded human review of a trace sample;
- an independently rerunnable artifact with pinned dependencies and seeds.

Until that work is complete, TOP remains a reproducible internal prototype and not a claim of production privacy.
