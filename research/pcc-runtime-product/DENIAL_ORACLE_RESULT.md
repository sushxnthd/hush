# PCC pre-approval denial oracle: frozen result

## Verdict

**FAIL.** Firewall denial was itself an unapproved private-result oracle.

| World | Private equality | Observable preparation result |
|---|---:|---|
| Secret 500, query `secret == 500` | True | Inference-firewall denial |
| Secret 501, same query | False | `decision: ask` |

No approval or consumption occurred. The observable difference therefore
recovered the private equality before the approval boundary. Repeating public
guesses would turn this differential into an exact-value search oracle over the
declared domain.

## Mechanism

The firewall correctly recognized that the true equality branch retained one
of 1,024 candidates and exceeded the eight-bit limit. However, it exposed that
result-dependent decision by throwing during preparation. The false branch
retained 1,023 candidates and returned normal approval metadata. A denial is a
message; when its occurrence depends on private state, it must be included in
the disclosure model.

## Evidence

- Preregistration commit: `642a284fe79a877103c45a60b0d080abf28fba94`
- Raw artifact SHA-256:
  `24e04f4a53be8aa97103a3b7b6c149c16c4f4ed8ed433a9d11cb37f9d4b50c6e`
- Declared domain: integer 0..1023
- Approvals: 0
- Consumptions: 0

## Cheapest correction

Keep the result-dependent preflight internal. Both worlds must return
indistinguishable `ask` preparation metadata. After explicit approval,
consumption may return either the authorized derived result or a generic
privacy-policy denial. A denied preflight must be consumed one-shot, emit no
constraint, and leave the posterior unchanged.

## Boundary

This deterministic differential establishes one agent-facing equality oracle.
It does not cover timing, malicious trusted contracts, semantic privacy, or
standing prior consent.
