# Authenticated MCP GET complete-mediation preregistration

Frozen before the outcome probe.

## Active HUSH breakthrough kernel

- **Precise question.** Does an authenticated `GET /mcp` cross the configured MCP-provider boundary with a brokered credential before Hush has produced a policy decision and durable receipt?
- **Best-known frontier.** The real runtime now rejects and receipts unsupported `DELETE /mcp` before dispatch. The remaining direct transport branch is authenticated GET, used for MCP session/stream transport.
- **Exact objective.** Start the real Hush server against a local observation upstream, issue one authenticated `GET /mcp?session=complete-mediation-probe` with explicit Hush agent and purpose metadata, and measure: upstream reachability, upstream method/path, whether the server-only bearer credential is attached, response status/body, receipt count before and after, and signed-chain validity. Repeat byte-identically and independently audit source order.
- **Strongest alternative explanation.** GET is a read-only transport operation and therefore need not be mediated. This does not answer the narrower complete-mediation question: crossing an external provider boundary while exercising a brokered credential is externally observable even when no remote mutation is intended. A negative result here falsifies only the product-wide mediation claim; it does not by itself prove disclosure or remote state mutation.
- **Cheapest decisive falsification.** If the observation upstream receives the authenticated GET while the durable receipt delta is zero, the product-wide “all brokered external effects are mediated and receipted” claim is false. If Hush denies locally, or produces a policy/attempt receipt before dispatch, this path passes the gate.
- **Publishable success condition.** A later complete path inventory plus real-server evidence must show every external-effect path is classified and either pre-dispatch mediated or covered by an explicit, defensible transport contract. This single probe is scoped evidence, not a breakthrough claim.
- **Project-relevance threshold.** The result must force one of two concrete runtime decisions: pre-dispatch authorize/receipt GET, or narrow the product contract and implement a safe transport classification with tests.
- **Kill condition.** A direct credential-bearing upstream dispatch with no receipt kills the current product-wide complete-mediation claim immediately.

## Protocol and holdout integrity

The upstream response is fixed to status 200, content type `text/event-stream`, and body `event: endpoint\ndata: /messages?session=probe\n\n`. The probe records observations rather than adapting the response. No frozen privacy/task-family holdout is opened. The primary endpoint and decision rule are frozen above before execution.
