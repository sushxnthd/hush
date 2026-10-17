# PCC selective-refusal oracle — frozen result

## Verdict: FAIL

The frozen differential reproduced the predicted selective-refusal oracle under
standing consent.

| World | Prepare | Consume | Observer learns |
|---|---|---|---|
| `secret = 500` | `approved` | generic privacy `deny` | equality is true |
| `secret = 501` | `approved` | allowed `false` | equality is false |

The two public transcripts differ despite identical public inputs and no new
human interaction. Result-dependent refusal therefore discloses the exact
equality bit that the firewall intended to withhold.

## Evidence provenance

- Frozen protocol: `SELECTIVE_REFUSAL_PREREGISTRATION.md`
- Probe: `run_selective_refusal_probe.mjs`
- Raw result: `selective_refusal_failure.json`
- Raw-result SHA-256:
  `4c17a2e2e50b1c2cea2ea4690f7e76f59fba1b73c39ba30518f40a3eb6fb5f6e`
- Reproduction:
  `node research/pcc-runtime-product/run_selective_refusal_probe.mjs --output research/pcc-runtime-product/selective_refusal_failure.json`

An initial harness execution checked for the internal label `allow` instead of
the public standing-consent label `approved`, so it skipped consumption. That
invalid execution was excluded. The protocol and prediction were unchanged;
the corrected harness was rerun, its stdout was byte-compared with the written
artifact, and only that result is reported here.

## Smallest supported claim

For the tested trusted equality contract over a bounded integer domain,
consumption-time result-dependent refusal is not transcript-private under
standing consent. This is a mechanism-level counterexample, not a claim of
remote compromise or universal PCC failure.

## Cheapest discriminating correction

Authorize against every feasible result branch before consent is applied. If
any feasible branch exceeds the partition budget, reject the query with the
same pre-consumption transcript in every private world. Then verify that a
balanced threshold whose two branches are safe remains usable.
