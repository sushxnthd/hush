# PCC pre-approval denial-oracle probe: preregistration

## Classification

DISCRIMINATION / ADVERSARIAL SECURITY.

## Hypothesis and mechanism

The realized-posterior firewall evaluates the private predicate during
`prepareConstraintRelease()`. A rare branch throws an inference-firewall error,
whereas a common branch returns ordinary `decision: ask` metadata. Therefore
the deny/prepare distinction may itself reveal the unreleased boolean result.

For an equality query over a 1,024-value domain, the true branch has one
candidate and exceeds the eight-bit knowledge limit; the false branch retains
1,023 candidates and is allowed. An agent that guesses values can therefore
use pre-approval denial as an equality oracle even though neither branch is
approved or consumed.

## Frozen prediction

Run the same trusted comparison contract `secret == 500` in two otherwise
identical worlds:

- World A: secret 500.
- World B: secret 501.

Make exactly one preparation request per world and perform no approval or
consumption. The non-disclosure gate fails if World A throws an
inference-firewall denial while World B returns `ask`, because that observable
difference recovers whether the private equality is true.

## Cheapest correction if falsified

Preparation must not reveal result-dependent firewall disposition. Preserve
the internal preflight, but return indistinguishable approval metadata for both
safe and firewall-denied results. Only after explicit approval may consumption
return either the authorized derived result or a generic privacy-policy denial.
Denied preflights must remain one-shot and must never commit posterior state or
emit the derived value.

## Boundary

This tests one bounded-integer equality contract at the agent-facing
pre-approval boundary. It does not establish timing-channel resistance,
malicious-contract safety, semantic privacy, or behavior under standing prior
consent.
