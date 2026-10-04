# Supakeep

**AI should query you, not copy you.**

Supakeep is an experimental **personal Context Kernel for AI**: a local trust boundary where agents can use private context and real-world authority without receiving unrestricted copies of either.

Instead of treating privacy as a one-time permission prompt, Supakeep governs an entire task trajectory:

- **what an AI may learn**
- **what an AI may infer through repeated queries**
- **what an AI may do**

The model is not the security boundary.

## Context Kernel prototype

A user-authorized task receives a Supakeep-minted **privacy trajectory**. Agents and sub-agents receive opaque, revocable context leases bound to that trajectory, agent, destination and private context atom.

The agent can request bounded computations such as presence checks, comparisons, ranges or masked views. Exact disclosure is an escalation rather than the default retrieval primitive.

Critically, Supakeep accounts for **query composition**. Repeating the exact same predicate has no additional privacy cost, but changing an adaptive predicate is treated as new information. This is designed to stop an agent from reconstructing a private value through a sequence of individually innocuous yes/no questions.

See `research/CONTEXT_KERNEL.md`.

## Implemented alpha

### Private context
- opaque, revocable context leases
- runtime-minted privacy trajectories
- cross-agent trajectory accounting
- disclosure levels: presence, boolean, derived, coarse, masked, exact
- cumulative and sink-aware privacy budgets
- compositional predicate accounting
- user-controlled trust profiles
- AI-footprint summaries without raw values

### Authority
- encrypted local vault (AES-256-GCM)
- Ed25519-signed, time-limited, task-scoped Grants
- agent / purpose / action / resource binding
- spend, merchant and recipient constraints
- allow / ask / deny policy engine
- exact-action human approvals with replay protection
- tamper-evident action receipt chain

### MCP enforcement
- observed `tools/list` catalog
- tool-call risk classification
- explicit trust boundary for MCP annotations
- fail-closed handling for unknown/untrusted tools
- hard deny for raw secret material in tool arguments
- exact-call approval binding
- transparent MCP enforcement proxy
- heuristic MCP exposure scanner
- vault-backed authorization brokerage so credentials need not enter model context

## Run

Requires Node.js 22+.

```bash
npm start
npm test
node bench/predicate-reconstruction.js
```

Open `http://127.0.0.1:8787` for the current local dashboard.

## Model

```text
private user state
       │
       ▼
 Supakeep Context Kernel
       │
       ├─ privacy trajectory
       ├─ context leases
       ├─ compositional disclosure ledger
       ├─ encrypted credential broker
       ├─ Grant verifier
       └─ exact-action approval gate
       │
       ▼
AI / agent / sub-agent
       │
       ▼
apps · APIs · MCP servers · browser · payments
```

The intended default is that an AI receives the **minimum useful result of a computation over private state**, not a raw copy of that state.

## Current evidence

The repository contains synthetic engineering tests, not a claim of real-world privacy safety.

The original 10,000-trajectory simulation tests cumulative disclosure budgets. A newer adversarial reconstruction test gives an agent a boolean comparison oracle over a hidden integer in `0..999999`. Unrestricted and naive field-level predicate access can continue toward exact reconstruction; the current Supakeep prototype interrupts the adaptive sequence on the sixth distinct predicate, leaving 31,250 candidate values.

That result demonstrates a mechanism invariant only. The research goal is to test whether trajectory-bound context computation can reduce recoverable private information while preserving useful agent task performance on real traces and against stronger inference attacks.

## Next falsification targets

1. colluding agents within one trajectory
2. colluding external sinks
3. sink aliasing and destination canonicalization
4. logically equivalent predicates expressed differently
5. high-cardinality membership and set queries
6. adversarial transforms that appear coarse but identify a user
7. real MCP/A2A task traces with privacy, task-success, approval and latency measurements
8. comparison against strong minimization, information-flow and inference-budget baselines

Supakeep can only enforce context and actions routed through a boundary it controls. It is an alpha/reference implementation, not a production security product.

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, `research/PRODUCT_THESIS.md`, and `research/CONTEXT_KERNEL.md`.
