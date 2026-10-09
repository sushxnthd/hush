# Hush

**Private Mode for every AI.**

Hush is a local trust layer for **deep AI personalization without handing every AI a copy of your private profile**. The browser workspace is early access; the native runtime is a release candidate with explicit release gates.

> **AI should query you, not copy you.**

Instead of moving your calendar, finances, identity, preferences, credentials and history into model context, an agent can send a bounded decision problem to Hush. Hush computes against private state locally and returns the minimum useful result.

## Use Hush today

- **Browser workspace:** https://sushxnthd.github.io/hush/app/ — encrypted private notes, approved memory, exact context preview and encrypted backups. No Hush account or API key required.
- **Sample workspace:** https://sushxnthd.github.io/hush/app/#sample — temporary data for a quick product walkthrough.
- **Local runtime:** run `node clients/desktop/hush-open.mjs` to start Hush and open its authenticated dashboard. Requires Node.js 22+ and a supported OS keystore. Portable candidates include `launchers/hush-open` (`hush-open.cmd` on Windows) and their own Node runtime.
- **Diagnostics:** `npm run doctor` checks local authentication, keystore, audit integrity, private context and single-instance storage. It reports no record values or credentials.
- **MCP:** `node clients/desktop/hush-desktop.mjs mcp-config` generates a local stdio client configuration without embedded bearer tokens. Keep Hush running while the client uses its six native tools.

The browser workspace makes no AI calls and does not enforce permissions in another app. It prepares manually reviewed context for copy and paste. Its encrypted browser store is separate from the native Context Kernel. The local runtime is a release candidate; external registrations, signed installers and independent assurance remain release gates.

## Release readiness

The current release candidate, strict evidence gate and remaining launch blockers are tracked in [PRODUCTION_LAUNCH_CHECKLIST.md](PRODUCTION_LAUNCH_CHECKLIST.md). Hush remains an early-access browser workspace and native release candidate until the external evidence domains are complete.

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

The runtime derives its Context Kernel wrapping secret from an OS-backed root key: Windows DPAPI, macOS Keychain or Linux Secret Service. No passphrase environment variable is needed for normal startup. `HUSH_CONTEXT_PASSPHRASE` remains an explicit compatibility override; retain it if an existing store was created with that override. OS keystores do not protect against a compromised unlocked host or promise hardware isolation.

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
hush_private_query
hush_private_decision
hush_route_task
hush_propose_memory
hush_revoke_private_task
```

Protected decisions are computed locally and privacy-assessed before their result enters the MCP response. Hush can also sit in front of another MCP server; upstream tools retain their existing order and Hush's private-computation tools are appended locally.

The implementation includes the current discovery shape plus a legacy initialization path, but protocol interoperability still needs broader testing against production clients before claiming full MCP conformance.

For local stdio clients, generate configuration rather than copying credentials:

```bash
node clients/desktop/hush-desktop.mjs mcp-config claude-desktop
```

Paste the JSON into the client's MCP settings. The bridge uses the installation's Node executable and absolute script path, derives only the separate MCP transport credential from the keystore, and forwards requests solely to local `/mcp`. Set the same `PORT` for the runtime and configuration generator when using a custom port. Source launches require Node.js on the machine; portable bundles use their included runtime.

The bridge supports Hush's native JSON tools. Streaming upstream proxies use the authenticated HTTP endpoint directly. Queue, message, response and request-time limits fail closed; failed authority requests are never automatically retried. A proposed memory requires explicit approval in the owner dashboard before it changes canonical context. Approved and rejected proposals erase their duplicate plaintext values; pending history expires and the queue is capped at 256 entries.

Start Hush first. On a standard source checkout:

```bash
node clients/desktop/hush-open.mjs
npm run doctor
```

For HTTP clients, use `http://127.0.0.1:8787/mcp` and the separately derived transport credential. MCP credentials cannot authorize owner APIs. Do not put control tokens in URLs or public client configuration.

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

## Run the local release candidate

Requires Node.js 22+.

```bash
npm start
```

Then run `node clients/desktop/hush-desktop.mjs dashboard` in another terminal to open a one-shot authenticated dashboard session. Alternatively use the `hush-open.mjs` entry point above. Authentication and strict keystore behavior are on by default; portable launchers force production mode. Linux requires a working Secret Service and `secret-tool`.

Only isolated development fixtures should use `NODE_ENV=development` with an explicit `HUSH_ALLOW_FILE_KEY_FALLBACK=1`. Anonymous local API access additionally requires `HUSH_REQUIRE_LOCAL_AUTH=0`; production ignores that bypass. A restrictive file key is not an OS-backed security substitute. The dashboard and doctor report the actual backend.

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

Run the suite for the current test count. CI verifies the runtime on Ubuntu, Windows and macOS and packages each platform separately. `npm run prod:gate` inspects all release domains; `npm run prod:report` emits a machine-readable report and returns a failing exit code while release gates remain blocked.

## What is not finished

Hush has implemented OS-backed keys, encrypted recovery/device revocation, bounded connectors, semantic capability resolution, symbolic joint-choice accounting, scoped actions and local companions. Implementations and synthetic checks alone do not finish the release.

- Signed Windows distribution and Apple Developer ID/notarization need the account owner's signing infrastructure.
- Production Google/GitHub registrations and live provider validation need approved provider identities and test credentials. Email/calendar tests perform real external actions and require a named test scope.
- Independent security review and scientific reproduction need identified external reviewers, retained findings and remediation/retest evidence.
- Full 72-hour fault/restart evidence, physical-device and assistive-technology validation, production-client interoperability and an owner-led incident drill remain acceptance requirements.
- Hosted OAuth, managed semantic/graph memory, team administration and enterprise service guarantees are not shipped Hush capabilities. The comparison in [COMPETITIVE_READINESS.md](COMPETITIVE_READINESS.md) identifies the actual product differences and the evaluation needed before claiming superiority.

See [LAUNCH_READINESS.md](LAUNCH_READINESS.md) for the evidence and the exact owner handoff. Historical evidence is retained but cannot certify changed candidate source.

## Research boundary

Personal data stores, local recommendation, preference elicitation, information-flow control, realized/privacy-loss accounting, inference-leakage budgets, zero-knowledge predicates, opaque handles, task-conditioned minimization and on-device ranking all have substantial prior art. Hush should **not** claim those individual ideas as inventions.

The hypothesis worth testing is the system-level combination: a provider-neutral personal-AI runtime where agents send bounded computations toward user-owned context, exact values remain sealed until necessary execution boundaries, and cumulative information / authority is governed across agents and providers.

Hush's native runtime remains a release candidate, not a certified production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, `research/CONTEXT_KERNEL.md`, `research/BLIND_PERSONALIZATION.md`, `research/RECONSTRUCTION_FIREWALL.md`, `research/PARTITION_AWARE_PRIVACY.md`, and `research/JOINT_CHOICE_PRIVACY.md`.
