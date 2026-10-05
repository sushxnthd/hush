# Hush v1.2 Acceptance Contract

Hush v1.2 is the convergence release. The release does **not** reduce the long-run Hush vision to fit an implementation shortcut. It finishes the complete user-controlled trust-layer architecture through bounded, independently testable engineering modules and then proves that those modules work together.

The product goal is:

> AI can know enough to help, act with narrowly scoped authority, and preserve user-owned memory without receiving unrestricted access to the user's private context, credentials, or long-lived authority.

## Non-negotiable release rule

v1.2 is complete only when every required capability below is implemented, integrated, and exercised by a reproducible acceptance path. A capability may use a safer underlying primitive (for example, OS-backed credential storage plus Hush capability brokerage instead of plaintext credential storage inside Hush) without reducing the user-visible capability.

No core capability is deferred to a hypothetical v2–v5 merely because it is difficult.

## Engineering modules

### M1 — Context Kernel and private state

Required capability:

- encrypted local private context
- durable sealed state
- typed context atoms with provenance, sensitivity, purpose and lifetime metadata
- local-first storage with explicit export/import boundaries
- user-owned cross-provider context portability
- deterministic migration/versioning of private state

Acceptance:

1. A fresh Hush instance can ingest synthetic private context, restart, recover it locally, and expose no plaintext through AI-facing interfaces.
2. Export/import round-trips preserve user-approved state and policy metadata.
3. Schema migration tests preserve historical receipts and disclosure accounting.

Current foundation: encrypted local Context Kernel and durable sealed state are already merged.

### M2 — Context compilation and minimum disclosure

Required capability:

- task-aware context compilation
- path-free semantic private queries
- minimum-necessary context selection
- inference-aware redaction/transformation
- sanitized fallback only under explicit approval when bounded computation is insufficient
- recipient/purpose-aware contextual integrity

Acceptance:

1. Raw, minimized and Hush-compiled paths run against identical frozen tasks.
2. Hush maintains the preregistered utility floor while reducing exact and semantic protected-context exposure.
3. Recipient and purpose mismatches fail closed or require explicit approval.

Current foundation: semantic private queries, task-aware compilation, sanitized fallback and contextual-integrity evaluation are already merged.

### M3 — Private Decision Programs / computation instead of disclosure

Required capability:

- bounded local predicates, ranking, filtering, comparison and selection over private data
- useful derived answers without revealing source facts when the task permits it
- connector-backed private computation, not synthetic-only demonstrations
- explicit proof/receipt of what computation ran and what result left the boundary

Acceptance:

1. At least one search, scheduling, recommendation/selection and connector-backed decision task succeeds without exposing the underlying protected facts to the model.
2. The same tasks are compared against raw retrieval and minimized retrieval under identical success metrics.
3. All released outputs are represented in the disclosure ledger.

### M4 — Reconstruction firewall and cumulative privacy

Required capability:

- cumulative disclosure accounting across turns
- cross-agent and cross-provider accounting
- partition, reconstruction and joint-choice defenses
- agent identity rotation resistance
- sink/destination rotation resistance
- trajectory rotation resistance
- colluding-agent and colluding-sink handling

Acceptance:

1. Repeated individually innocuous queries cannot reconstruct protected values beyond configured disclosure budgets.
2. The same attack remains blocked when identities/providers/sinks are rotated.
3. Multi-agent collusion benchmarks remain executable in CI with frozen expected behavior.

Current foundation: reconstruction, partition, joint-choice and cross-agent defenses are already merged and benchmarked.

### M5 — Universal consent, Grants and policy

Required capability:

- one policy system spanning context, memory and actions
- allow once / always allow / ask / never
- signed scoped Grants bound to subject × agent × purpose × action × resource × constraints × expiry × use-count
- exact-action approvals
- per-agent trust profiles
- revocation that takes effect before future use

Acceptance:

1. Materially changing recipient, amount, resource, action or other approved arguments invalidates prior approval.
2. One-use grants cannot be replayed.
3. Revoked authority cannot be exercised by any supported agent/provider path.

Current foundation: signed Grants, consent rules, exact-action approvals and replay-safe tickets are already merged.

### M6 — Credential and secretless action brokerage

Required capability:

- long-lived credentials remain outside model context
- opaque credential/capability handles
- brokered authorization inserted only at the trusted boundary
- OS keychain / secure enclave integration where available
- scoped side effects for send / schedule / modify / delete / publish / transactional-style actions
- action-result leakage controls

Acceptance:

1. Supported actions complete without raw long-lived credentials appearing in model-visible prompts, tool arguments, logs or receipts.
2. Credentials can be revoked independently of memory/context state.
3. At least one bounded transactional-style action is exercised in a synthetic/sandbox environment with exact-action approval and replay protection.

Current foundation: secretless action brokerage and replay-safe action tickets are already merged; hardened OS-backed credential storage remains a v1.2 requirement.

### M7 — Connector and provider onboarding

Required capability:

- OAuth 2.0 / PKCE onboarding for Google and GitHub
- encrypted refresh-token storage
- least-privilege scopes
- explicit re-auth/revocation states
- one-click initial sync
- connection-health surface
- no terminal or copied bearer tokens for a normal user

Acceptance:

A fresh user can install Hush, connect supported accounts through browser consent, reach a usable private context state, revoke access, and reconnect without touching a terminal or pasting an access token.

Current foundation: bounded clients exist for Gmail, Google Calendar, Google Drive, Google Contacts and GitHub. Zero-terminal onboarding remains open.

### M8 — Cross-AI memory and provider routing

Required capability:

- provider-neutral shared memory
- approval-gated writes
- user-owned portable memory across supported AI providers
- privacy-aware model routing
- policy-preserving provider switching
- no provider becomes the canonical owner of user memory

Acceptance:

1. The same approved memory can be used across at least two provider adapters without copying the raw memory store into either provider.
2. Switching providers preserves Hush policy, disclosure accounting and revocation semantics.
3. Unauthorized memory writes are rejected or approval-gated.

Current foundation: provider-neutral shared memory and privacy-aware routing are already merged.

### M9 — AI Footprint, receipts and user control surface

Required capability:

- tamper-evident receipts
- disclosure history by category, purpose and destination
- authority inventory
- AI Footprint across connected agents/providers
- global revocation and emergency lockdown
- recovery/device/connector management
- understandable approval consequences

Acceptance:

From one user-facing surface, the user can determine what each AI received, why it received it, what authority it currently has, what actions occurred, where information went, and how to revoke that access.

Current foundation: tamper-evident receipts and encrypted sync/recovery exist; full consumer trust surface remains a v1.2 requirement.

### M10 — Multi-device, browser, desktop and mobile product

Required capability:

- signed encrypted multi-device sync
- ciphertext-only recovery
- authenticated device pairing
- browser companion
- desktop companion
- mobile companion
- signed installers/updates where applicable
- crash-safe receipt/sync state

Acceptance:

1. Two authorized devices converge on the same approved encrypted state without exposing plaintext to the sync layer.
2. Revoking a device prevents subsequent sync/use.
3. Browser, desktop and mobile surfaces all exercise the same Hush policy and receipt semantics.

Current foundation: browser, desktop and mobile companion surfaces plus encrypted sync/recovery are already present; production hardening remains open.

### M11 — Open protocol, SDK and runtime adapters

Required capability:

- documented Grant, receipt, capability and disclosure formats
- stable developer SDK
- MCP mediation
- adapters for major agent/runtime paths
- versioned schemas and compatibility tests
- provider/runtime integrations that cannot bypass Hush silently when operating inside the declared boundary

Acceptance:

1. A third-party test agent can integrate using only public documentation and SDK interfaces.
2. Unknown tools fail closed to ASK; raw credential-like tool arguments remain hard-denied.
3. Compatibility tests cover schema/version negotiation and receipt verification.

Current foundation: MCP mediation and loopback-safe client SDK exist; stable documented external protocol remains a v1.2 requirement.

### M12 — Scientific validation and superiority evidence

Required capability:

- exact and semantic leakage scoring
- task success/completeness metrics
- approval-friction and latency metrics
- action-result leakage metrics
- prompt-injection, side-channel, collusion and reconstruction stress tests
- frozen untouched confirmatory holdouts
- direct named-comparator experiments where technically runnable
- preserved negative results and explicit claim boundaries
- independent reproduction package

Acceptance:

1. A preregistered end-to-end benchmark shows a better privacy/task-success tradeoff than an unguarded semantic context path on a frozen holdout.
2. Direct competitor comparisons use the same workload, threat model and metrics.
3. Final claims are no broader than the evidence.
4. Independent reproduction can be attempted from the repository without private implementation details.

Current foundation: executable privacy/utility/reconstruction/parity benchmarks, the Scientific Superiority Protocol and a frozen external AgentCIBench confirmatory evaluation already exist. Semantic leakage, full end-to-end task evaluation and independent reproduction remain open.

## Internal future-facing infrastructure retained in v1.2

Context Forks / Perspectives are not part of current public positioning, but their enabling primitives must not be designed out of v1.2. Hush should preserve the ability to create isolated, permissioned context views with separate disclosure/accounting histories without weakening the core trust boundary.

## Integration gates

Individual module completion is necessary but insufficient. The following integrated flows must pass before v1.2 can be called complete:

1. **Know** — connect accounts → ingest private context → compile the minimum context → answer without unnecessary disclosure.
2. **Decide** — run a private decision over protected context → return only the derived result → record a verifiable receipt.
3. **Act** — request a side effect → evaluate policy → obtain exact-action approval when required → broker credentials outside model context → execute → record outcome and leakage accounting.
4. **Remember** — write approved shared memory → use it from another provider → preserve ownership, disclosure budgets and revocation.
5. **Revoke** — revoke an agent, connector, credential or device → prove subsequent attempted use fails across every supported surface.
6. **Attack** — exercise prompt injection, reconstruction, cross-agent collusion, provider switching and sink rotation → preserve the configured privacy boundary.

## Master release gate

The canonical v1.2 CI/release gate should eventually execute, at minimum:

```bash
npm test
npm run bench
npm run check:v1.2
```

`check:v1.2` must become a dedicated end-to-end acceptance runner covering the integrated flows above. Until that command exists and every required acceptance path is green, v1.2 remains unfinished.

## Execution rule

Development proceeds module-by-module to keep work bounded and testable, but the scope is the entire contract above. Every implementation task must identify:

1. the module it advances;
2. the user-visible capability being preserved;
3. the test/benchmark that proves progress;
4. the remaining gap after the change.

This is an execution decomposition, not a feature reduction.
