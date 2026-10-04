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
         │ privacy firewalls    │
         │ authority broker     │
         └──────────────────────┘
                │
                ▼
      bounded result / approved action
```

Private values remain behind the Supakeep boundary. Raw/exact private output is deliberately not part of the normal private-decision language.

## Sealed private context

Supakeep has a persistent encrypted Context Kernel rather than an in-memory-only profile.

- a random 256-bit data-encryption key encrypts private records with AES-256-GCM;
- a scrypt-derived wrapping key protects that data key;
- paths, labels, categories, tags, privacy-domain metadata, values and reconstruction state are encrypted rather than stored as readable metadata;
- ciphertext is authenticated, so modified records fail closed;
- exported sync bundles contain ciphertext and opaque identifiers, not readable context;
- restarting Supakeep restores private context and cumulative reconstruction state.

The alpha currently unlocks this local store from `SUPAKEEP_CONTEXT_PASSPHRASE`. A consumer build should move key handling into the operating-system keychain / secure hardware rather than asking users to manage an environment variable.

## Private Decision Programs

The declarative private-computation runtime currently supports:

- boolean predicates;
- coarse numeric buckets;
- `choose` over public candidates using private constraints and preferences.

For fields without a declared finite privacy domain, an explicit result with `|Ω|` possible values is conservatively charged using the output-cardinality bound:

```text
I(S;Y) <= H(Y) <= log2(|Ω|)
```

### Why output cardinality was not enough

A binary output does **not** imply that the answer which actually occurred revealed only one bit of pointwise knowledge.

For an integer secret in `0..999999`, the query:

```text
secret == 734219 ?
```

has only two possible outputs. Cardinality-only accounting therefore prices it at one nominal bit. But if the answer is `true`, the feasible state collapses from 1,000,000 values to one:

```text
log2(1,000,000 / 1) = 19.931569 bits
```

Supakeep v0.7 adds a **partition-aware reconstruction firewall** for declared finite integer domains. Before releasing a predicate or bucket result, the runtime computes the posterior feasible set induced by the actual answer and measures:

```text
realized gain = log2(candidates before / candidates after)
```

The result is denied *before release* if it would exceed the configured knowledge budget. Equivalent predicates that leave the same feasible set add zero realized knowledge, while rare branches that collapse the feasible set can be blocked immediately.

There are now **three complementary accounting layers**:

1. a short-lived task/sink budget;
2. a persistent cross-task reconstruction firewall; and
3. for declared finite integer domains, realized partition accounting over the remaining feasible state.

Changing an agent name, purpose label, task id, destination, or restarting the local runtime therefore does not automatically provide a fresh reconstruction budget.

These remain **explicit-channel defenses**, not a claim of total information leakage. Timing, failures, network metadata, side effects, compromised hosts, covert channels and anything that bypasses Supakeep remain outside the guarantee. Partition-aware accounting currently covers declared finite integer domains for predicate/bucket semantics; multi-field `choose` programs still use the conservative output-cardinality path.

## Reproducible evidence

All results below are synthetic engineering tests, not real-world privacy guarantees.

### Realized partition leakage

For a hidden integer in `0..999999`:

- exact-match query nominal output capacity: **1 bit**;
- exact-match `true` branch realized knowledge gain: **19.931569 bits**;
- v0.7 partition-aware decision: **DENY before release**;
- harmless false equality probes released: **1,000**;
- realized knowledge from those 1,000 false probes: **0.001443 bits**;
- balanced binary refinements released: **8**;
- query 9: **DENY**;
- candidates still feasible: **3,906**.

The important result is not merely stricter blocking. The same mechanism is **less wasteful** than charging every boolean query one full bit: low-information branches can remain useful while high-information rare branches are stopped.

### Blind personalization

A reproducible flight demo supplies 15 public candidates and uses private travel constraints locally.

- raw private values returned: **0**;
- selected result: one candidate ID;
- explicit output cardinality: **16**;
- conservative explicit-channel capacity: **4 bits**;
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

Supakeep exposes bounded private computation over its local `/mcp` endpoint. The native agent surface intentionally contains **no raw-context dump tool**.

Current native tools are:

```text
supakeep_begin_private_task
supakeep_private_decision
supakeep_revoke_private_task
```

When a protected finite-domain field is queried through native MCP, the result is computed locally, assessed against the realized posterior, and can be denied before the result enters the MCP response. The test suite exercises this path directly.

Supakeep can also sit in front of another MCP server; upstream tools retain their existing order and Supakeep's private-computation tools are appended locally.

The implementation includes the current discovery shape plus a legacy initialization path, but protocol interoperability still needs broader testing against production clients before claiming full MCP conformance.

## Existing security and authority layer

### Private context

- sealed persistent context store;
- opaque, revocable context leases;
- runtime-minted task trajectories;
- persistent cross-trajectory reconstruction firewall;
- partition-aware realized privacy guard for declared finite integer domains;
- global field and per-audience disclosure budgets;
- ciphertext-only portable bundles;
- user-controlled trust profiles;
- exposure summaries without stored private values;
- rejection of prototype-like unsafe private paths;
- strict trajectory-TTL validation.

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

A finite-domain context field can be created through the local API with domain metadata such as:

```json
{
  "path": "finance.balance",
  "value": 734219,
  "category": "finance",
  "domain": {"type":"integer","min":0,"max":999999}
}
```

The domain metadata is stored inside the encrypted context record. The API can report that the field is partition-protected and summarize remaining feasible-state exposure without returning the private value itself.

Validation commands:

```bash
npm test
npm run bench
npm run check
```

The v0.7 integration currently passes **78 automated tests** plus all benchmark programs.

## What is not finished

Supakeep has a functional private-context research core, but it is not yet a finished consumer security product. Production work still includes:

- OS keychain / Secure Enclave-style key handling and recovery;
- encrypted multi-device sync and device revocation;
- real connectors for calendar, mail, files, accounts and other context sources;
- browser / desktop / mobile onboarding;
- one-click authorization flows for popular AI clients;
- richer capability schemas so agents do not need to know private field paths;
- full protocol interoperability testing;
- timing, crash, network-metadata and bypass defenses;
- real end-to-end task benchmarks and stronger collusion attacks;
- semantic privacy accounting for multi-field `choose` programs and richer domains;
- unifying private-context disclosure and real-world authority into one task ledger.

## Research boundary

Personal data stores, local recommendation, information-flow control, realized/privacy-loss accounting, inference-leakage budgets, zero-knowledge predicates, opaque handles, task-conditioned minimization and on-device ranking all have substantial prior art. Supakeep should **not** claim those individual ideas as inventions.

The hypothesis worth testing is the system-level combination: a provider-neutral personal-AI runtime where agents send bounded computations toward user-owned context, exact values remain sealed until necessary execution boundaries, and cumulative information / authority is governed across agents and providers.

Supakeep is an alpha/reference implementation, not a certified production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, `research/CONTEXT_KERNEL.md`, `research/BLIND_PERSONALIZATION.md`, `research/RECONSTRUCTION_FIREWALL.md`, and `research/PARTITION_AWARE_PRIVACY.md`.
