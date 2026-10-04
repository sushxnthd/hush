# Supakeep

**Private Mode for every AI.**

Supakeep is an experimental local trust layer for **deep AI personalization without handing every AI a copy of your private profile**.

The core idea is simple:

> **AI should query you, not copy you.**

Instead of moving your calendar, finances, identity, preferences, credentials and history into model context, an agent can send a bounded decision problem to Supakeep. Supakeep computes against private state locally and returns the minimum useful result.

## Blind personalization

A travel agent should not need your complete personal profile just to choose a flight.

```text
public flight options
        │
        ▼
      AI agent
        │  candidates + bounded decision request
        ▼
     Supakeep
        │  locally uses private budget, calendar,
        │  preferences, identity state, etc.
        ▼
 chosen candidate / bounded result
```

The private values remain behind the Supakeep boundary.

The same pattern can apply to shopping, scheduling, job matching, browser actions, eligibility checks and other personalized agent workflows.

See `research/BLIND_PERSONALIZATION.md`.

## Private Decision Programs

Supakeep now includes an experimental declarative runtime for computations over private state.

Current program types include:

- boolean predicates
- coarse numeric buckets
- `choose` over public candidates using private constraints and preferences

Raw/exact private output is deliberately not part of this decision language.

### Information-bounded outputs

If an explicit result can take one of `|Ω|` possible values, then its controlled output channel has the conservative bound:

```text
I(S;Y) <= H(Y) <= log2(|Ω|)
```

Supakeep tracks these bounds across one runtime-minted task trajectory. For example:

- boolean -> at most 1 explicit bit
- 4 buckets -> at most 2 explicit bits
- choose 1 of 15 candidates or no match -> 16 outputs -> at most 4 explicit bits

This is an **explicit-channel bound**, not a claim of total information leakage. Timing, failures, side effects, covert channels and anything that bypasses Supakeep remain outside that guarantee.

## Current prototype evidence

All results below are synthetic engineering tests, not real-world privacy claims.

### Blind personalization

A reproducible demo supplies 15 public flight candidates and uses three private travel fields locally.

- raw private values returned: **0**
- selected result: one candidate ID
- explicit output cardinality: **16**
- worst-case explicit-channel capacity: **4 bits**
- trajectory budget: **4 bits**
- second distinct 4-bit decision in the same trajectory: **DENY**

### Adaptive reconstruction

A hidden integer in `0..999999` is attacked through adaptive greater-than queries.

- unrestricted predicate oracle: exact recovery in **20** queries
- naive per-field boolean accounting: exact recovery in **20** queries
- Supakeep trajectory accounting: stopped on query **6**, with **31,250** candidates remaining

### Cumulative-disclosure simulation

Across 10,000 synthetic adversarial trajectories:

- allow-all baseline crossing synthetic leak threshold: **100.00%**
- per-call sensitive filter: **99.93%**
- Supakeep cumulative budget: **0.00%**

A separate benign smoke test completes **99.14%** of synthetic tasks without an approval interruption.

See `bench/RESULTS.md` for assumptions and caveats.

## Existing security/authority layer

Supakeep also implements:

### Private context
- opaque, revocable context leases
- runtime-minted privacy trajectories
- cross-agent trajectory accounting
- cumulative and sink-aware disclosure budgets
- user-controlled trust profiles
- AI-footprint summaries without raw values

### Authority
- encrypted local vault (AES-256-GCM)
- Ed25519-signed, time-limited, task-scoped Grants
- agent / purpose / action / resource binding
- spend, merchant and recipient constraints
- allow / ask / deny policy engine
- exact-action approvals with replay protection
- tamper-evident action receipts

### MCP enforcement
- observed `tools/list` catalog
- tool-call risk classification
- fail-closed unknown/untrusted tools
- untrusted annotation handling
- hard deny for raw secret material in tool arguments
- transparent MCP enforcement proxy
- heuristic MCP exposure scanner
- vault-backed authorization brokerage

## Run

Requires Node.js 22+.

```bash
npm start
npm test
npm run bench
```

Open `http://127.0.0.1:8787` for the current local dashboard.

## The target product

A user should eventually be able to tell any compatible AI:

> **Book me the best Tokyo trip next month under my normal budget.**

The AI searches and plans normally. Supakeep locally applies private calendar, budget, identity and preference state, returns only bounded decision outputs, and brokers passport/payment details directly to the authorized booking destination when execution requires them.

The user gets deep personalization. The AI provider does not need to own the personal profile that produced it.

That is the thesis we are now trying to falsify.

## Research boundary

Personal data stores, local recommendation, information-flow control, inference-leakage budgets, zero-knowledge predicates, opaque handles, task-conditioned minimization and on-device ranking all have substantial prior art. Supakeep should **not** claim those individual ideas as inventions.

The hypothesis worth testing is the system-level combination: a provider-neutral personal-AI runtime where agents send bounded computations toward user-owned context, exact values remain sealed until necessary execution boundaries, and cumulative information/authority is governed across agents and providers.

Supakeep is currently an alpha/reference implementation, not a production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, `research/CONTEXT_KERNEL.md`, and `research/BLIND_PERSONALIZATION.md`.
