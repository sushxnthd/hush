# Architecture

Supakeep is a local enforcement boundary between AI systems and private context/actions. The model may propose; Supakeep authorizes outside the model.

## Authority path

A signed **Grant** is bound to `subject × agent × purpose × action × resource × constraints × expiry × use-count`.

Local policy may still require explicit approval. Approvals hash the exact proposed action, so changing a recipient, amount, resource, tool, or other material argument invalidates the approval.

## Privacy path

Private context is represented as disclosures with:

- agent
- purpose
- destination/sink
- category
- disclosure level
- stable atom identifier

Marginal information cost is tracked per agent, while cumulative purpose and sink budgets are aggregated across agents. This prevents multiple agents working on the same purpose from independently exhausting separate privacy budgets.

The ledger stores hashes/metadata for accounting rather than raw private values in its AI-footprint summary.

## MCP path

Supakeep observes `tools/list`, classifies tools, and mediates `tools/call` requests before execution.

Security rules include:

- unknown tools fail closed to ASK
- MCP annotations are treated as untrusted hints unless the upstream is explicitly trusted
- raw credential-like material in tool arguments is hard-denied
- exact user approval can override ASK but never a hard deny
- forwarded headers are minimized
- brokered authorization can replace caller-provided credentials before forwarding

The exposure scanner is heuristic and is not a vulnerability scanner.

## Boundary

Supakeep only controls traffic routed through it. Direct agent-to-service connections remain outside its enforcement boundary.

The current implementation is an alpha/reference implementation. Production work still requires durable storage, hardened key management, OAuth connectors, browser/device mediation, formalized schemas, and substantially broader adversarial testing.
