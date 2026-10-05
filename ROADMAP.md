# Roadmap

Hush is the user-controlled trust layer between people and AI systems: private context stays under user control, AI receives only the minimum result it needs, and side effects require scoped authority.

## Current state — 2026-10-05

### Implemented and merged

- encrypted local Context Kernel and durable sealed state
- signed scoped Grants, allow / ask / deny policy, exact-action approvals, tamper-evident receipts
- path-free semantic private queries and task-aware context compilation
- cumulative disclosure accounting, cross-agent accounting, reconstruction / partition / joint-choice firewalls
- approval-gated sanitized-context fallback for tasks that cannot be expressed as bounded private computation
- encrypted connector ingestion plus bounded live clients for Gmail, Google Calendar, Google Drive, Google Contacts and GitHub
- provider-neutral shared memory with approval-gated writes
- privacy-aware model routing
- universal consent rules including allow-once, always-allow, ask and never
- secretless action brokerage with opaque credential handles and replay-safe action tickets
- signed encrypted multi-device sync and ciphertext-only recovery kits
- browser, desktop and mobile companion surfaces built on the same loopback-safe client SDK
- executable privacy / utility / reconstruction / parity benchmarks in CI
- preregistered internal privacy–utility evaluation
- frozen external contextual-integrity confirmatory evaluation with all preregistered gates passing

### What the current evidence establishes

Hush now has reproducible evidence that its context boundary can reduce protected-context exposure while preserving high task-context completeness on a frozen external holdout. This is meaningful validation of the architecture, but it is not yet proof of production readiness or universal superiority.

The largest measured research weakness is still absolute protected-context violation on the external holdout. Independent reproduction, semantic-leakage scoring and full end-to-end task evaluation remain open.

## Milestone A — zero-terminal provider onboarding

Goal: make Hush usable by a normal consumer without manually supplying bearer tokens or running setup commands.

- OAuth 2.0 / PKCE onboarding for Google and GitHub
- local token brokerage so long-lived credentials never enter model context
- encrypted refresh-token storage and explicit connector revocation
- connection-health and re-authentication states in the companion UI
- one-click initial sync into the Context Kernel
- connector-specific least-privilege scopes and bounded collection defaults

Success criterion: a fresh user can install Hush, connect supported accounts through browser consent, and reach a usable private context state without touching a terminal or copying an access token.

## Milestone B — real end-to-end task proof

Goal: demonstrate that Hush completes useful tasks with materially less private-context exposure than an unguarded semantic context path.

- task-success benchmark spanning search, scheduling, document lookup and bounded actions
- real connector data fixtures separated from synthetic research fixtures
- semantic leakage scoring in addition to exact-value leakage
- approval count and approval-friction metrics
- gateway latency and action latency measurements
- multi-agent collusion, colluding-sink and prompt-injection stress tests
- side-effect consequences and action-result leakage tests

Success criterion: preregistered evidence of a better privacy / task-success tradeoff on end-to-end tasks, with no hidden tuning on the final holdout.

## Milestone C — consumer trust surface

- AI Footprint dashboard across connected agents
- per-agent trust profiles
- disclosure history by category, purpose and destination
- authority inventory for send / buy / modify / delete / publish
- global revocation and emergency lockdown
- understandable approval UX with clear consequences
- recovery, device and connector management

Success criterion: from one screen, a user can understand what each AI knows, what it may do, where information went, what happened on the user's behalf and how to revoke it.

## Milestone D — hardened local product

- OS keychain / secure enclave integration where available
- signed installers and signed updates
- crash-safe receipt and sync state
- policy migration / versioning
- native desktop packaging and browser-store packaging
- authenticated device pairing for mobile
- adversarial security review and independent reproduction of core claims

## Milestone E — portable trust layer

- documented Grant and receipt formats
- stable developer SDK
- adapters for major agent runtimes
- standards alignment where practical
- external red-team work and third-party verification

## Product rule

New features should strengthen one of four things: minimum disclosure, user-owned context, scoped authority, or verifiable accountability. Hush should not drift into becoming a generic password manager, generic memory product, enterprise IAM suite, or model-training company.
