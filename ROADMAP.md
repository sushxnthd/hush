# Roadmap

Hush's goal is not to become another password manager or generic MCP gateway. The roadmap is organized around proving and productizing the **personal trust layer for AI**.

## Phase 0 — alpha enforcement core

Status: largely implemented.

- encrypted local vault
- signed scoped Grants
- exact-action approvals
- allow / ask / deny policy
- tamper-evident receipts
- prompt secret detection/redaction
- disclosure ledger and trust profiles
- cumulative purpose/sink privacy budgets
- cross-agent privacy accounting
- MCP tool catalog, classifier and enforcement proxy
- heuristic MCP exposure scan
- vault-backed authorization brokerage
- synthetic privacy and utility benchmarks

## Phase 1 — falsify the privacy thesis

Goal: determine whether cumulative disclosure accounting provides a measurable advantage without unacceptable approval fatigue.

- adaptive multi-turn inference attacks
- multi-agent collusion attacks
- colluding-sink scenarios
- prompt-injection attacks against category/purpose/sink labeling
- privacy vs task-success Pareto curves
- approval-fatigue measurement
- gateway latency benchmarks
- replay real MCP traces from multiple agent stacks

Success criterion: a reproducible benchmark where Hush reduces cumulative leakage/exposure while retaining useful task completion, with all assumptions and synthetic components clearly separated from real-world evidence.

## Phase 2 — real integrations

- Google OAuth connector with brokered tokens
- GitHub OAuth connector with brokered tokens
- MCP Streamable HTTP interoperability hardening
- browser extension for page/action mediation
- connector-specific minimum-disclosure transformations

Success criterion: complete real tasks without placing long-lived credentials into model context and with verifiable action/disclosure receipts.

## Phase 3 — consumer trust surface

- AI Footprint dashboard across connected agents
- per-agent trust profiles
- disclosure history by category/purpose/destination
- authority inventory: send / buy / modify / delete / publish
- revocation and emergency lockdown
- understandable approval UX

Success criterion: a user can answer, from one place, what each AI knows, what it can do, where information went, and what happened on their behalf.

## Phase 4 — hardened local product

- durable encrypted storage
- OS keychain / secure enclave integration
- signed updates
- crash-safe receipt chain
- policy migration/versioning
- backup and recovery without exposing plaintext secrets
- desktop packaging

## Phase 5 — portable trust layer

- documented Grant format
- documented receipt format
- developer SDK
- adapters for major agent runtimes
- standards alignment where practical
- third-party verification / external red-team work

## Non-goals for now

- largest tool catalog
- password-manager replacement
- enterprise IAM suite
- proprietary OAuth replacement
- generic AI memory product
- model training company

The product should only add features that strengthen Hush's position as the neutral, user-controlled trust layer across AI systems.
