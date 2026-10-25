# HUSH-PCC-053 — freeze: deterministic request-hash low-entropy preapproval channel

Date 2026-10-25. Bounded secondary workstream on existing branch and draft PR #45. No Lucent branch or workflow modifications. **Not a deployed exploit claim.**

## Hypothesis and scope
Hush `ActionBroker.request` returns `safeTicket.requestHash`, an unkeyed deterministic SHA-256 digest of a request binding including `arguments`. If trusted application code injects a low-entropy *private* argument into a broker request and subsequently exposes the returned safe ticket to a lower-trust HTTP observer, that observer can enumerate candidate argument values offline and recover the private value **before approval or execution**. This is a classical deterministic-commitment dictionary channel, distinct from HUSH-052's scheduler-order channel. The threat model assumes the private argument is *not already known to the observing client*; if an agent supplied the value, there is no additional confidentiality breach.

## Frozen predictions
P1. Under two private worlds, `privateFlag=zero` and `privateFlag=one`, the real ActionBroker issues an unapproved `ask` ticket with the same public metadata. The ticket's `requestHash` differs deterministically.
P2. An independent offline SHA-256/canonicalization candidate enumeration recovers both values **2/2** from the exposed hash without asking for approval, resolving credentials or running an adapter. No secret value is included directly in the HTTP response.
P3. A deliberately narrow HTTP projection that omits `requestHash`, ticket IDs, timestamps and other private-dependent fields yields identical public payloads for both worlds. This control demonstrates a projection-level mitigation for the particular channel, **not** complete whole-runtime noninterference.
P4. A preapproval HTTP wrapper is intentionally constructed to expose the broker's safe ticket hash. No claim that a deployed Hush endpoint accepts trusted private arguments or exposes this exact response shape.
P5. Product/release consequence: treat unkeyed request hashes as **public equality/dictionary oracles**; require a reviewed public/private field classification, avoid exposing hashes of private low-entropy arguments, and preserve external security-review and runtime observable-closure release blockers. No new release attestation is minted and no deployment readiness is claimed.

## Reproduction and negative controls
Use Node built-in `node:test`, real `ActionBroker`, `sha256/canonicalize` from Hush core and real loopback HTTP; no external providers or credentials. Use fixed metadata and independently computed candidate bindings. Assert zero approvals, adapter executions, credential resolutions, external provider commits. Re-run HUSH-052 order-channel and HUSH-046 unmediated-egress controls in dedicated CI. A passing CI is a successful **negative confidentiality witness**, not a safety certification.

## Scientific priority
This is standard low-entropy hash inversion/dictionary attack and observational noninterference, not a new cryptographic theorem. Keep PR #45 draft/unmerged, no force push, no unrelated source changes.
