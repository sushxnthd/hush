# Hush × Charlie public-capability parity

**Benchmark status:** executable synthetic acceptance suite  
**Public target reference:** https://www.inrupt.com/meet-charlie  
**Reference checked:** 2026-10-05

This benchmark is deliberately narrower than a marketing comparison. Inrupt publicly describes Charlie as a personal AI that helps users collect/connect important information, pulls together relevant information for a task and recommends an AI, and disguises personal details before information is sent onward. Those are the **public capability classes** used as the parity target here.

The repository does not contain Charlie's implementation and this benchmark does not claim to measure Charlie itself. A passing result means Hush demonstrates the same capability class under a reproducible synthetic test, not that the two systems have equal quality, security, latency, product maturity, or user experience.

## Public-parity gates

| Gate | Hush acceptance criterion |
| --- | --- |
| Connected user context | Connector data enters the encrypted Context Kernel and exported sync ciphertext contains none of the seeded plaintext markers. |
| Task-relevant context | A private personalization task reaches the correct result without returning the seeded private values or raw private paths. |
| Best-AI routing | Bounded private computation can use the strongest eligible remote model while strict content-bearing private context remains local. |
| Personal-detail disguise | Content-bearing fallback replaces seeded direct identifiers and coarsens exact numeric detail, while remaining approval-gated. |

## Beyond-parity gates

Hush's thesis is stronger than data-wallet parity: **do as much as possible without revealing the underlying private state at all**. The suite therefore also verifies:

- provider-neutral memory that survives a restart and personalizes a different AI without returning the memory value;
- user-owned scoped consent with allow / ask / deny behavior outside the model provider;
- secretless action authority where an adapter can use a credential but the calling AI never receives it;
- realized-leakage protection that withholds a highly identifying bounded answer before release;
- signed ciphertext portability plus recovery without plaintext private context in transport/recovery artifacts.

## Privacy contrast

The benchmark includes a simple marker-based contrast between a direct raw-profile baseline and Hush's bounded-result path. This is only a sanity check: counting seeded strings is **not** an information-theoretic privacy metric and must not be presented as one.

For reconstruction-sensitive decision outputs, Hush's existing partition, joint-choice, symbolic and connected-posterior benchmarks remain the relevant technical evidence.

## Run

```bash
npm run bench:charlie
npm run bench:charlie:json
```

The command exits non-zero if any acceptance gate fails.

## Interpretation rules

1. Do not claim Charlie is insecure, leaks a specific amount of information, or lacks a feature unless independently verified from current public evidence.
2. Do not call this a head-to-head benchmark unless Charlie itself is instrumented under the same workload.
3. Keep synthetic data, public product claims and Hush experimental results clearly separated.
4. Treat a failing Hush gate as a product/research finding, not something to hide from the report.
