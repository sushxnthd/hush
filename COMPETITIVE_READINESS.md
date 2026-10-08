# Hush competitive readiness

Reviewed 8 October 2026 against public, first-party product documentation. This is a capability audit, not a performance comparison or independent product review. Hush's website is published; its browser workspace is early access and native runtime is a release candidate.

## Current capability comparison

| User need | Hush | Competitor evidence | Remaining Hush work |
| --- | --- | --- | --- |
| Context across MCP clients | Six local native tools, authenticated HTTP, and a stdio bridge/config generator with no embedded bearer token. Owner and agent credentials are separate. | [Supermemory MCP](https://supermemory.ai/mcp/) describes managed OAuth, shared spaces, search and document access. [Zep Context MCP](https://help.getzep.com/v3/context-mcp-server) describes user graph context behind the deployment's IdP. | Test the exact candidate in production versions of each supported client; publish a tested compatibility matrix. Hush does not offer a managed remote OAuth MCP endpoint. |
| Local/private deployment | Same-device runtime, encrypted context, OS-backed root key, cumulative explicit-disclosure accounting and private bounded decisions. | [Supermemory local](https://github.com/supermemoryai/supermemory/blob/main/apps/docs/self-hosting/quickstart.mdx) supports local deployment; [Mem0 open source](https://docs.mem0.ai/open-source/overview) provides self-managed memory infrastructure. | Local deployment is not unique to Hush. Validate the complete private-decision workflow on real user tasks and reproduce the privacy results independently. |
| Memory ingestion and recall | Manual encrypted notes plus explicit memory proposals, owner approval, semantic capability resolution and bounded results. No unilateral agent write to canonical memory. | Supermemory documents semantic recall, extracted/linked/updated memories and source documents. [Mem0](https://github.com/mem0ai/mem0) documents persistent memory infrastructure with graph/vector options. | Hush does not ship equivalent managed document OCR, general semantic graph recall or an automatically extracted user profile. Establish the desired boundary before expanding ingestion. |
| Easy installation | Source `hush-open.mjs`; portable candidates include their Node runtime, dashboard opener, MCP bridge and doctor launchers. | Competitors document managed onboarding and local/self-hosted installation paths. | Sign/notarize installers, complete first-run usability and physical-device checks, retain install/update evidence. Portable candidates are unsigned. |
| Provider actions | Scoped Google/GitHub onboarding implementation, secretless action broker, one-use approvals and signed audit receipts. | Memory products' documented memory APIs are a different scope from Hush's local action authority boundary. | Account-owner registrations, provider production approval and explicitly scoped live-action E2E. Do not infer broader action capability or superiority from a different product scope. |
| Enterprise readiness | Published security model and release gates; no certified enterprise service. | [Zep enterprise](https://www.getzep.com/enterprise/) describes cloud/VPC deployment and a trust center. Supermemory describes managed organizations and scoped spaces. | Staffed support/incident owner, independent review, enterprise administration, compliance evidence and service guarantees are absent. |

## Engineering improvements completed in this pass

- Normal startup authenticates owner APIs and MCP and requires OS-backed keys unless a file fallback is explicitly selected. Portable launchers enforce production mode. Development anonymous access requires a separate explicit switch.
- All three HTTP body readers share size, object-shape and upload-time bounds. SDK responses are bounded while streaming; requests cannot move control credentials to a different origin or redirect. Unexpected request errors omit private payloads and paths.
- Native stdio MCP has message/queue/deadline limits, JSON-only protocol output and no retry of authority calls. Notifications cannot execute native tools. MCP authentication cannot grant owner API access.
- Memory proposals cap retained values and queue size, remove expired records and erase duplicate plaintext values after approval/rejection. Approved canonical memory remains encrypted in the Context Kernel.
- Runtime diagnostics and the portable dashboard opener expose the real authentication/keystore/audit state. Release candidates record source cleanliness and an inventory digest.
- The release gate requires scoped v2 evidence, exact source identity, artifact hashes/retention and named independent reviewers where required. Historical results cannot certify changed source. External authenticity still requires accountable review.

## Evidence required for “equivalent or better”

1. Freeze named competitor versions/configuration, deployment model, corpus, task set and budget. Compare the same user jobs, including ingestion, correction, forgetting, cross-client recall and private decisions. Record unsupported features instead of silently removing them.
2. Run matched blinded trials and report task success, exact/contextual leakage, false denials, latency distributions, cost, recovery outcomes and setup completion. Include uncertainty and per-task failure analysis; do not compare published scores from different datasets.
3. Reproduce the benchmark with an identified independent reviewer, publish a usable reproduction package and retain the exact artifacts. Hush's existing internal synthetic/frozen-context results support their bounded claims, not universal commercial superiority.
4. Complete signed distribution, current-candidate 72-hour durability, accessibility/device/client validation and owner-led incident response before changing the native release label.

The differentiated product hypothesis is useful bounded decisions over private state with cumulative disclosure and explicit action authority. The current evidence does not justify a blanket competitor-superiority claim.
