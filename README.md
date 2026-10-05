# Hush

**Private Mode for every AI.**

Hush is an experimental local trust layer for **deep AI personalization without handing every AI a copy of your private profile**.

> **AI should query you, not copy you.**

Instead of moving your calendar, finances, identity, preferences, credentials and history into model context, an agent can send a bounded decision problem to Hush. Hush computes against private state locally and returns the minimum useful result.

## How it works

```text
public candidates / bounded question
                │
                ▼
             AI agent
                │
                ▼
         Hush Context Kernel
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

Private values remain behind the Hush boundary. Raw/exact private output is deliberately not part of the normal private-decision language.

## Sealed private context

Hush has a persistent encrypted Context Kernel rather than an in-memory-only profile.

- a random 256-bit data-encryption key encrypts private records with AES-256-GCM;
- a scrypt-derived wrapping key protects that data key;
- paths, labels, categories, tags, privacy-domain metadata, values and reconstruction state are encrypted rather than stored as readable metadata;
- ciphertext is authenticated, so modified records fail closed;
- exported sync bundles contain ciphertext and opaque identifiers, not readable context;
- restarting Hush restores private context and cumulative reconstruction state.

The alpha currently unlocks this local store from `HUSH_CONTEXT_PASSPHRASE`. A consumer build should move key handling into the operating-system keychain / secure hardware rather than asking users to manage an environment variable.

## Private Decision Programs

The declarative private-computation runtime currently supports:

- boolean predicates;
- coarse numeric buckets;
- `choose` over public candidates using private constraints and preferences.

For interfaces without an analyzable finite-domain model, Hush retains the conservative output-cardinality bound:

```text
I(S;Y) <= H(Y) <= log2(|Ω|)
```

But output alphabet size is not enough to measure how informative the result that actually occurred was. v0.7 added single-field realized partition accounting; v0.8 extended the same idea to protected `choose` decisions; and v0.9 adds exact symbolic region counting so structured joint spaces can be analyzed without explicit Cartesian enumeration.

## Four privacy-accounting layers

Hush v0.9 can combine:

1. a short-lived task/sink budget;
2. a persistent cross-task reconstruction firewall;
3. single-field realized partition accounting for declared finite integer domains; and
4. joint-choice realized accounting for multi-field recommendation/selection programs whose joint private state is exactly analyzable.

Changing an agent name, purpose label, task id, destination, or restarting the local runtime therefore does not automatically provide a fresh reconstruction budget.

These remain **explicit-channel defenses**, not a claim of total information leakage. Timing, failures, network metadata, side effects, compromised hosts, covert channels and anything that bypasses Hush remain outside the guarantee.

## Why nominal output size is not enough

### Single-field rare branch

For an integer secret in `0..999999`, the query:

```text
secret == 734219 ?
```

has only two possible outputs and therefore one nominal bit. If the answer is `true`, however, one million feasible values collapse to one:

```text
log2(1,000,000 / 1) = 19.931569 bits
```

The partition-aware firewall measures the realized posterior shrinkage and can deny that branch before release.

### Multi-field malicious candidate set

A recommendation result can also act as a query. The v0.8 benchmark creates **16 private binary fields**, so there are **65,536 possible joint profiles**. An adversarial caller supplies only **two public candidates** and chooses their public attributes/scoring so that one candidate wins for exactly one of those profiles.

The `choose` interface has three possible outputs (two ids plus `null`), so cardinality-only accounting charges:

```text
log2(3) = 1.584963 bits
```

Yet the rare winner identifies one of 65,536 profiles:

```text
log2(65,536 / 1) = 16 bits
```

The **JointChoiceReconstructionFirewall** computes that posterior before release and withholds the rare winner.

The common winner is also handled more usefully: it leaves 65,535 profiles feasible and costs only **0.000022014 realized bits** rather than the full nominal 1.584963-bit charge.

## Reproducible evidence

All results below are synthetic engineering tests, not real-world privacy guarantees.

### Joint-choice candidate-set attack

| Condition | Result |
|---|---:|
| Private binary fields | 16 |
| Joint profiles | 65,536 |
| Public candidates | 2 |
| Explicit output cardinality | 3 |
| Cardinality-only charge | 1.584963 bits |
| Rare winner realized knowledge | **16 bits** |
| Cardinality-only runtime | **ALLOW rare winner** |
| v0.9 joint guard | **DENY before release** |
| Denied response contains selected result | **No** |
| Common winner remaining profiles | 65,535 |
| Common winner realized charge | **0.000022014 bits** |
| Common winner | **ALLOW** |

The joint guard composes prior released choices across overlapping private-field sets, persists that history inside encrypted Context Kernel state, and invalidates affected history when a protected private field changes. Public privacy telemetry deliberately omits the selected candidate so the ledger itself does not become a disclosure channel.

v0.9 removes the old hard 100,000-state enumeration boundary for supported `choose` semantics. It first performs exact symbolic interval branch-and-bound, counting whole private-state regions whenever the winner can be proven invariant. A 32-field binary benchmark therefore analyzes **4,294,967,296** possible joint profiles, detects a **32-bit** rare-winner disclosure, and denies it before release. The common branch leaves 4,294,967,295 profiles feasible and is allowed.

If symbolic analysis exceeds its configured work budget, Hush falls back to exact enumeration only when the remaining state is small enough; otherwise it withholds the result. Internal accounting retains unrounded leakage even when public telemetry rounds a tiny marginal value to zero.

### Realized single-field partition leakage

For a hidden integer in `0..999999`:

- exact-match query nominal output capacity: **1 bit**;
- exact-match `true` branch realized knowledge gain: **19.931569 bits**;
- partition-aware decision: **DENY before release**;
- harmless false equality probes released: **1,000**;
- realized knowledge from those probes: **0.001443 bits**;
- balanced binary refinements released: **8**;
- query 9: **DENY**;
- candidates still feasible: **3,906**.

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
- Hush trajectory accounting: stopped after **6** answers, with **31,250** candidates remaining.

### Cross-trajectory reconstruction

The attacker deliberately starts a fresh one-bit trajectory for every adaptive query.

- no persistent firewall: exact recovery in **20** answers;
- persistent firewall, one sink: **6** answers released, query 7 denied, **15,625** candidates remain;
- persistent firewall, rotating sinks: **8** answers released, query 9 denied, **3,906** candidates remain.

### Cumulative-disclosure simulation

Across 10,000 synthetic adversarial trajectories:

- allow-all baseline crossing synthetic leak threshold: **100.00%**;
- per-call sensitive filter: **99.93%**;
- Hush cumulative budget: **0.00%**.

A separate benign smoke test completes **99.14%** of synthetic tasks without an approval interruption.

## Native AI connection

Hush exposes bounded private computation over its local `/mcp` endpoint. The native agent surface intentionally contains **no raw-context dump tool**.

Current native tools are:

```text
hush_begin_private_task
hush_private_decision
hush_revoke_private_task
```

Protected decisions are computed locally and privacy-assessed before their result enters the MCP response. Hush can also sit in front of another MCP server; upstream tools retain their existing order and Hush's private-computation tools are appended locally.

The implementation includes the current discovery shape plus a legacy initialization path, but protocol interoperability still needs broader testing against production clients before claiming full MCP conformance.

## Existing security and authority layer

### Private context

- sealed persistent context store;
- opaque, revocable context leases;
- runtime-minted task trajectories;
- persistent cross-trajectory reconstruction firewall;
- partition-aware realized privacy guard for declared finite integer domains;
- joint-choice realized privacy guard for analyzable multi-field `choose` programs;
- symbolic branch-and-bound for scalable exact choice-support counting;
- overlapping-choice composition across connected private fields;
- encrypted persistence of partition and joint reconstruction state;
- redacted privacy telemetry;
- global field and per-audience disclosure budgets;
- ciphertext-only portable bundles;
- user-controlled trust profiles;
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
export HUSH_CONTEXT_PASSPHRASE='use-a-long-local-passphrase'
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

The domain metadata is stored inside the encrypted context record. The API can report partition/joint privacy status without returning private values or the selected results stored in the internal joint ledger.

Validation commands:

```bash
npm test
npm run bench
npm run check
```

The v0.8 suite contains **84 automated tests** plus **seven benchmark programs**.

## What is not finished

Hush has a functional private-context research core, but it is not yet a finished consumer security product. Production/research work still includes:

- OS keychain / Secure Enclave-style key handling and recovery;
- encrypted multi-device sync and device revocation;
- real connectors for calendar, mail, files, accounts and other context sources;
- browser / desktop / mobile onboarding;
- one-click authorization flows for popular AI clients;
- richer capability schemas so agents do not need to know private field paths;
- full protocol interoperability testing;
- timing, crash, network-metadata and bypass defenses;
- real end-to-end task benchmarks and stronger collusion attacks;
- scalable joint inference beyond the current 100,000-state exact enumeration limit;
- categorical, structured, continuous and correlated private domains;
- privacy-vs-task-success evaluation against strong baselines;
- unifying private-context disclosure and real-world authority into one task ledger.

## Research boundary

Personal data stores, local recommendation, preference elicitation, information-flow control, realized/privacy-loss accounting, inference-leakage budgets, zero-knowledge predicates, opaque handles, task-conditioned minimization and on-device ranking all have substantial prior art. Hush should **not** claim those individual ideas as inventions.

The hypothesis worth testing is the system-level combination: a provider-neutral personal-AI runtime where agents send bounded computations toward user-owned context, exact values remain sealed until necessary execution boundaries, and cumulative information / authority is governed across agents and providers.

Hush is an alpha/reference implementation, not a certified production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, `research/CONTEXT_KERNEL.md`, `research/BLIND_PERSONALIZATION.md`, `research/RECONSTRUCTION_FIREWALL.md`, `research/PARTITION_AWARE_PRIVACY.md`, and `research/JOINT_CHOICE_PRIVACY.md`.
