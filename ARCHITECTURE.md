# Architecture
Supakeep is a local gatekeeper between AI agents and private context/actions. The model may propose; Supakeep authorizes outside the model.

A signed **Grant** is bound to `subject × agent × purpose × action × resource × constraints × expiry × use-count`. Local policy may still require explicit approval. Approvals hash the exact proposed action, so changing a recipient, amount, resource, or other material argument invalidates the approval.

The current alpha enforces only traffic routed through Supakeep. The next milestone is an MCP Streamable HTTP proxy that mediates real `tools/call` traffic, followed by OAuth-brokered Google/GitHub connectors and a browser extension.
