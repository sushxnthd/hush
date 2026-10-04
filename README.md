# Supakeep

**Supakeep is a local-first personal trust layer for AI.**

AI systems increasingly need private context, credentials, accounts and real-world authority to complete useful work. Supakeep sits outside the model and governs both:

- **what an AI may know**
- **what an AI may do**

The model is not the security boundary.

## Implemented alpha

### Authority
- encrypted local vault (AES-256-GCM)
- Ed25519-signed, time-limited, task-scoped Grants
- agent / purpose / action / resource binding
- spend, merchant and recipient constraints
- allow / ask / deny policy engine
- exact-action human approvals with replay protection
- tamper-evident action receipt chain

### Privacy
- secret detection and prompt redaction
- disclosure levels: presence, boolean, derived, coarse, masked, exact
- cumulative disclosure budgets
- sink-aware privacy budgets
- user-controlled trust profiles
- cross-agent purpose-level accounting
- AI-footprint summaries without storing raw disclosed values in the summary

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
```

Open `http://127.0.0.1:8787`.

Run the test suite:

```bash
npm test
```

## Product model

```text
AI / agent / MCP client
        │
        │ asks for context or proposes an action
        ▼
     Supakeep
        ├─ disclosure ledger + privacy budgets
        ├─ encrypted secret broker
        ├─ Grant verifier
        ├─ policy engine
        ├─ MCP exposure scanner
        └─ exact-action approval gate
        │
        ▼
apps · tools · APIs · browser · payments · MCP servers
```

Supakeep can only enforce traffic routed through a boundary it controls. It is an alpha/reference implementation, not a production security product.

## Current evidence

The repository includes synthetic privacy/utility benchmarks. In the current cumulative-disclosure simulation, Supakeep enforces the intended invariant that individually acceptable disclosures cannot accumulate indefinitely without ASK/DENY. These are engineering tests of the mechanism, **not claims of real-world privacy safety or competitor superiority**.

See `bench/RESULTS.md`.

## Next milestones

1. adaptive multi-agent and colluding-sink privacy attacks
2. replay real MCP traces and measure privacy/utility/latency tradeoffs
3. Google/GitHub OAuth connectors using brokered tokens
4. browser extension for page/action mediation
5. local semantic privacy classifier for private context
6. desktop keychain / secure-enclave integration
7. portable Grant + receipt format aligned with emerging agent authorization standards

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, `ROADMAP.md`, and `research/PRODUCT_THESIS.md`.
