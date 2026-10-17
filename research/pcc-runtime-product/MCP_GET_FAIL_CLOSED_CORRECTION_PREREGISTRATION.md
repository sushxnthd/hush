# Frozen protocol: MCP GET pre-dispatch mediation correction

Frozen after the decisive bypass result at `75496c23b8c32d89622d8fe5ebddf0dcc0fecf04` and before changing runtime code.

## Active HUSH breakthrough kernel

- **Precise question.** Can Hush route authenticated MCP GET transport through a durable pre-dispatch receipt boundary, using configured-upstream presence as the explicit static authorization basis, while preserving streaming behavior and recording both successful and failed upstream outcomes?
- **Best-known frontier.** The real-server falsification showed GET crossing the provider boundary with a brokered credential and zero receipts. DELETE is already rejected and receipted before dispatch.
- **Exact objective.** For a successful GET, require two signed, chained receipts: an `approved/attempt` receipt persisted before upstream observation, then an `allow/outcome` receipt after upstream response headers are received. Bind the returned response to the outcome receipt hash. For a connection failure after the attempt, require a second `error/outcome` receipt. Preserve exact upstream status/body and credential brokering.
- **Strongest alternative explanation.** A receipt appended just before calling `fetch` may be cosmetic rather than mediation because no dynamic permission evaluator runs. The scoped correction therefore claims only a non-bypassable audit/authorization boundary whose authorization basis is the administrator-configured upstream, not user-specific semantic permission or absence of disclosure.
- **Cheapest decisive falsification.** Start the real Hush server against an observation upstream. Fail the correction if the upstream observes the request before an attempt receipt exists, if success produces anything other than two ordered signed receipts, if the response is not bound to the outcome receipt, or if an unreachable upstream leaves only the attempt receipt.
- **Publishable success condition.** A reproducible real-server mechanism that enforces pre-dispatch durable evidence and outcome closure on both success and connection failure, plus source-order audit and regression tests. Product-wide complete mediation remains unclaimed until all other external-effect paths are classified.
- **Project-relevance threshold.** The correction must alter `src/server.js`, preserve MCP GET streaming compatibility, and make the exact prior bypass probe fail for the intended reason: receipt delta is nonzero and ordered before dispatch.
- **Kill condition.** Any upstream observation preceding durable attempt evidence, missing error outcome, credential exposure in receipts, broken response forwarding, invalid chain, or non-deterministic receipt projection kills the correction.

## Frozen gates

Successful upstream:

1. exact status/body forwarding;
2. brokered server credential observed and client credential not forwarded;
3. exactly two new receipts in chronological chain order;
4. attempt receipt decision `approved`, phase `attempt`, authorization basis `configured_mcp_upstream`;
5. outcome receipt decision `allow`, phase `outcome`, upstream status 200;
6. upstream callback observes receipt count at least one at request arrival;
7. response `x-hush-receipt-hash` equals the outcome receipt hash;
8. chain valid and no raw credential material present.

Connection failure:

1. no successful upstream response;
2. exactly two new receipts;
3. ordered `approved/attempt` then `error/outcome`;
4. valid signed chain and no raw credential material.
