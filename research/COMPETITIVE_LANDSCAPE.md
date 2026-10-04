# Supakeep competitive landscape — October 2026

This file is a product-research snapshot, not a claim of exhaustive parity. It focuses on what competitors publicly ship or document today and what Supakeep should *not* try to copy as a standalone wedge.

## Charlie / Inrupt

Public strengths:
- personal data layer built around Solid/Pods
- purpose-specific access grants and revocation
- MCP integration
- persistent personal context
- user-visible auditability
- TEE-based privacy-preserving processing
- agent-to-agent workflows
- experimental privacy ideas such as controlled inaccuracy / false-data release

Strategic implication: **personal-data ownership + purpose-bound access is already occupied.** Supakeep should not position as “Charlie but with permissions.”

## 1Password for Claude

Public strengths:
- zero-exposure credential use
- credentials do not enter model context
- per-task user approval
- session-scoped access instead of standing access
- direct browser authentication/injection

Strategic implication: **credential brokerage alone is not a moat.** Supakeep should integrate with or complement password managers rather than reinventing them.

## Arcade

Public strengths:
- delegated user + agent authorization at runtime
- token vault / OAuth management
- per-action authorization
- MCP/tool execution
- thousands of agent-optimized tools
- pre-authorization for longer-running jobs
- audit / governance surfaces

Strategic implication: **developer-focused tool authorization and integration breadth are already crowded.** Supakeep should not try to out-catalog Arcade early.

## Permit.io

Public strengths:
- MCP gateway between clients and servers
- identity, policy, consent, fine-grained authorization
- per-tool-call enforcement and audit
- no need to rewrite the downstream MCP server

Strategic implication: **an MCP policy proxy is a necessary component, not a unique company thesis.**

## Descope

Public strengths:
- MCP OAuth 2.1 authorization
- granular tool scopes
- user consent + policy controls
- downstream credential isolation

Strategic implication: standards-compliant auth should be reused, not reinvented.

## Outerlimit

Public strengths:
- discover / observe / enforce agent estates
- deterministic action-layer enforcement
- zero standing access / credential reconstruction
- in-tenant deployment
- tamper-resistant audit and multi-hop identity concepts

Strategic implication: enterprise runtime security is becoming a well-funded category. Supakeep should avoid competing head-on as another enterprise agent firewall.

# White space Supakeep should own

**Cross-agent personal trust.**

Supakeep should be the user-controlled layer that answers, across providers and agents:

1. What does this AI know about me?
2. What is it allowed to learn next?
3. What is it allowed to do?
4. Which destination is receiving my information?
5. How much has already been disclosed across the whole task?
6. What requires my approval?
7. What happened after I stopped watching?

The differentiating primitives are therefore:

- cumulative disclosure budgets
- sink-aware privacy budgets
- user-controlled trust profiles
- minimum-disclosure transformations
- cross-agent AI-footprint summaries
- exact-action grants and approvals
- tamper-evident action + disclosure receipts
- a provider-neutral local enforcement boundary

# Product rule

Do not add a feature merely because a competitor has it. Add it only if it strengthens Supakeep's position as **the personal trust layer across AI systems**.
