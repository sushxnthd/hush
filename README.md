# Supakeep

**Supakeep is a local-first privacy and authority layer for AI agents.**

Models are becoming capable enough to do real work. The bottleneck is increasingly whether they can safely access the private context, credentials, accounts and actions required to complete that work.

Supakeep separates **what an AI can know** from **what an AI can do** and puts both behind a user-controlled boundary.

## What is implemented in this first MVP

- encrypted local vault (AES-256-GCM)
- secret detection and prompt redaction
- Ed25519-signed, time-limited, task-scoped Grants
- agent / purpose / action / resource binding
- spend, merchant and recipient constraints
- allow / ask / deny policy engine
- exact-action human approvals with replay protection
- tamper-evident action receipt chain
- local dashboard for approvals, vault, redaction and action simulation
- zero runtime dependencies

## Run

Requires Node.js 22+.

```bash
npm start
```

Then open `http://127.0.0.1:8787`.

Run the security-core tests:

```bash
npm test
```

## Product model

```text
AI agent
   │ proposes an action / asks for context
   ▼
Supakeep
   ├─ context minimization
   ├─ encrypted secret broker
   ├─ signed Grant verifier
   ├─ policy engine
   └─ approval gate
   │
   ▼
apps · tools · APIs · browser · payments
```

The model is **not** the security boundary. Supakeep makes authorization decisions outside the model.

## Current boundary

This repository is an alpha/reference implementation. Supakeep can only enforce actions routed through a boundary it controls. The next production milestone is a real MCP gateway so agent `tools/call` traffic can be mediated before execution.

## Next milestones

1. MCP Streamable HTTP gateway + tool schema risk classifier
2. Google/GitHub OAuth connectors using brokered tokens
3. browser extension for page/action mediation
4. local semantic privacy classifier for private context
5. desktop secure enclave/keychain integration
6. portable Grant / receipt format aligned with emerging agent authorization standards

See `ARCHITECTURE.md`, `THREAT_MODEL.md`, and `ROADMAP.md`.
