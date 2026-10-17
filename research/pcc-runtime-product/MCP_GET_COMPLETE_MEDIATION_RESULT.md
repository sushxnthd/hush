# MCP GET bypass independently falsifies product-wide complete mediation

Status: **DECISIVE FALSIFICATION**

The preregistered real-server probe executed Hush against a deterministic local
MCP observation upstream. An authenticated
`GET /mcp?session=complete-mediation-probe` produced:

- upstream observations: 1
- upstream method: `GET`
- upstream credential: configured server-only bearer credential
- client-visible credential forwarded: no
- upstream status/body returned through Hush: exact match
- Hush receipt count before: 0
- Hush receipt count after: 0
- receipt delta: **0**
- signed receipt-chain validity before/after: true/true
- independent repeat: byte-identical from a fresh server process

The upstream did not receive the supplied Hush agent or purpose metadata. This
is consistent with the transport branch bypassing the JSON-RPC policy/audit
envelope rather than merely omitting the final receipt append.

An independent source-order audit confirmed that the GET branch calls
`fetchMcpUpstream` and pipes the response without a policy evaluation or receipt
call. The audited `src/server.js` SHA-256 is
`a366972eabfd99cf4195783f30220a8541ebdbe2b12786f2ba6784f31332c720`.

## SCIENCE ledger

The result is an independent transport-class counterexample to product-wide
complete mediation, after the earlier DELETE counterexample was corrected.
Read-only intent is insufficient to exempt the path from this claim: the
observed operation crosses the configured provider boundary and exercises a
brokered credential. The test does not establish disclosure, remote mutation,
or unsafe MCP semantics.

Smallest supported claim:

> At revision `226b0fe`, authenticated MCP GET reaches the configured upstream
> with a brokered bearer credential and returns the upstream response without
> creating a Hush receipt.

The broader standalone full-trace theorem remains valid for executions that
actually pass through `TracePolicyMonitor`; this result shows the product does
not yet route every brokered provider interaction through that boundary.

## CONSEQUENCE ledger

The DELETE-only correction is not sufficient for Hush to claim product-wide
complete mediation. The runtime must either:

1. create a durable pre-dispatch attempt/authorization receipt for GET transport
   operations and explicitly authorize the provider/session target, or
2. narrow the product contract and implement a defensible safe-transport class
   that still records brokered credential exercise and destination.

Until one of those contracts survives a prospective real-server test, GET must
remain an explicit assurance exception. The next correction should preserve
this failure artifact and fix the runtime in a later commit rather than
rewriting the evidence.

## Reproduction

```bash
node research/pcc-runtime-product/run_mcp_get_mediation_probe.mjs /tmp/get.json
python3 research/pcc-runtime-product/audit_mcp_get_mediation.py
```

Canonical dynamic artifact SHA-256:
`aae57e853d229bf6cc00575afc4db0a157eb3626c8951717556ddc6da86a9d22`

Independent static artifact SHA-256:
`2652df711eb170aea1d39d854a65cb1f3870158de7d0882fb351ecbf87d18b6d`

No external provider, paid service, private data, or frozen task holdout was used.
