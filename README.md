# Supakeep

**Private Mode for every AI.**

Supakeep is an experimental local trust layer for **deep AI personalization without handing every AI a copy of your private profile**.

> **AI should query you, not copy you.**

Instead of moving your calendar, finances, identity, preferences, credentials and history into model context, an agent can send a bounded decision problem to Supakeep. Supakeep computes against private state locally and returns the minimum useful result.

## How it works

```text
public candidates / bounded question
                │
                ▼
             AI agent
                │
                ▼
         Supakeep Context Kernel
         ┌──────────────────────┐
         │ sealed private state │
         │ decision runtime     │
         │ disclosure budgets   │
         │ authority broker     │
         └──────────────────────┘
                │
                ▼
      bounded result / approved action
```

Private values remain behind the Supakeep boundary. Raw/exact private output is deliberately not part of the normal private-decision language.

## Sealed private context

Supakeep now has a persistent encrypted Context Kernel rather than an in-memory-only profile.

- a random 256-bit data-encryption key encrypts private records with AES-256-GCM;
- a scrypt-derived wrapping key protects that data key;
- paths, labels, categories, tags, values and reconstruction state are encrypted rather than stored as readable metadata;
- ciphertext is authenticated, so modified records fail closed;
- exported sync bundles contain ciphertext and opaque identifiers, not readable context;
- restarting Supakeep restores private context and cumulative reconstruction state.

The alpha currently unlocks this local store from `SUPAKEEP_CONTEXT_PASSPHRASE`. A consumer build should move key handling into the operating-system keychain / secure hardware rather than asking users to manage an environment variable.

## Private Decision Programs

The declarative private-computation runtime currently supports:

- boolean predicates;
- coarse numeric buckets;
- `choose` over public candidates using private constraints and preferences.

If an explicit result can take one of `|Ω|` possible values, Supakeep conservatively accounts up to:

```text
I(S;Y) <= H(Y) <= log2(|Ω|)
```

There are now **two accounting layers**:

1. a short-lived task-trajectory budget; and
2. a persistent reconstruction firewall that tracks exposure associated with private fields across new trajectories, agents and sinks.

Changing an agent name, purpose label, task id or destination therefore does not automatically provide a fresh global field budget.

This remains an **explicit-channel bound**, not a claim of total information leakage. Timing, failures, network metadata, side effects, covert channels and anything that bypasses Supakeep remain outside that guarantee.

## Reproducible evidence

All results below are synthetic engineering tests, not real-world privacy guarantees.

### Blind personalization

A reproducible flight demo supplies 15 public candidates and uses private travel constraints locally.

- raw private values returned: **0**;
- selected result: one candidate ID;
- explicit output cardinality: **16**;
- worst-case explicit-channel capacity: **4 bits**;
- a second distinct 4-bit decision in the same 4-bit trajectory: **DENY**.

### Adaptive reconstruction inside one task

For a hidden integer in `0..999999`:

- unrestricted predicate oracle: exact recovery in **20** queries;
- naive per-field boolean accounting: exact recovery in **20** queries;
- Supakeep trajectory accounting: stopped after **6** answers, with **31,250** candidates remaining.

### Cross-trajectory reconstruction

The attacker deliberately starts a fresh one-bit trajectory for every adaptive query.

- no persistent firewall: exact recovery in **20** answers;
- persistent firewall, one sink: **6** answers released, query 7 denied, **15,625** candidates remain;
- persistent firewall, rotating sinks: **8** answers released, query 9 denied, **3,906** candidates remain.

This closes the specific task-reset / sink-rotation attack exercised by the benchmark. It does not prove arbitrary private information cannot be inferred.

### Cumulative-disclosure simulation

Across 10,000 synthetic adversarial trajectories:

- allow-all baseline crossing synthetic leak threshold: **100.00%**;
- per-call sensitive filter: **99.93%**;
- Supakeep cumulative budget: **0.00%**.

A separate benign smoke test completes **99.14%** of synthetic tasks without an approval interruption.

## Native AI connection

Supakeep can expose bounded private computation over its local `/mcp` endpoint. The native agent surface intentionally contains **no raw-context dump tool**.

Current native tools are:

```text
supakeep_begin_private_task
supakeep_private_decision
supakeep_revoke_private_task
```

An AI can therefore start a task, submit a bounded decision program and receive the result without being given the underlying values. Supakeep can also sit in front of another MCP server; upstream tools retain their existing order and Supakeep's private-computation tools are appended locally.

The implementation includes the current discovery shape plus a legacy initialization path, but protocol interoperability still needs broader testing against production clients before claiming full MCP conformance.

## Existing security and authority layer

### Private context

- sealed persistent context store;
- opaque, revocable context leases;
- runtime-minted task trajectories;
- persistent cross-trajectory reconstruction firewall;
- global field and per-audience disclosure budgets;
- ciphertext-only portable bundles;
- user-controlled trust profiles;
- exposure summaries without stored private values.

### Authority

- encrypted local credential vault;
- Ed25519-signed, time-limited, task-scoped Grants;
- agent / purpose / action / resource binding;
- spend, merchant and recipient constraints;
- allow / ask / deny policy engine;
- exact-action approvals with replay protection;
- tamper-evident action receipts.

### MCP enforcement

- native bounded private-computation tools;
- observed upstream `tools/list` catalog;
- tool-call risk classification;
- fail-closed unknown/untrusted tools;
- untrusted annotation handling;
- hard deny for raw secret material in tool arguments;
- transparent MCP enforcement proxy;
- heuristic exposure scanner;
- vault-backed authorization brokerage.

## Run the alpha

Requires Node.js 22+.

```bash
export SUPAKEEP_CONTEXT_PASSPHRASE='use-a-long-local-passphrase'
npm start
```

Then open `http://127.0.0.1:8787` for the local dashboard. The local MCP endpoint is `/mcp`.

Validation commands:

```bash
npm test
npm run bench
npm run check
```

## What is not finished

Supakeep now has a functional private-context core, but it is not yet a finished consumer security product. Production work still includes:

- OS keychain / Secure Enclave-style key handling and recovery;
- encrypted multi-device sync and device revocation;
- real connectors for calendar, mail, files, accounts and other context sources;
- browser / desktop / mobile onboarding;
- one-click authorization flows for popular AI clients;
- richer capability schemas so agents do not need to know private field paths;
- full protocol interoperability testing;
- timing, crash, network-metadata and bypass defenses;
- real end-to-end task benchmarks and stronger collusion / equivalent-query attacks;
- unifying private-context disclosure and real-world authority into one task ledger.

## Research boundary

Personal data stores, local recommendation, information-flow control, inference-leakage budgets, zero-knowledge predicates, opaque handles, task-conditioned minimization and on-device ranking all have substantial prior art. Supakeep should **not** claim those individual ideas as inventions.

The hypothesis worth testing is the system-level combination: a provider-neutral personal-AI runtime where agents send bounded computations toward user-owned context, exact values remain sealed until necessary execution boundaries, and cumulative information / authority is governed across agents and providers.

Supakeep is an alpha/reference implementation, not a certified production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, `research/CONTEXT_KERNEL.md`, `research/BLIND_PERSONALIZATION.md`, and `research/RECONSTRUCTION_FIREWALL.md`.
