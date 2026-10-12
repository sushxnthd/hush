# PCC selective-refusal oracle — correction result

## Verdict: PASS for the frozen differential

PCC now authorizes comparison releases against every feasible result branch
before applying consent. If any branch would exceed the partition budget, the
query is denied with the same pre-consumption transcript in every private
world.

| World | Before correction | After correction |
|---|---|---|
| `secret = 500` | `approved` → privacy `deny` | pre-consumption `deny` |
| `secret = 501` | `approved` → allowed `false` | pre-consumption `deny` |

The unchanged frozen probe can no longer distinguish the worlds. A separate
balanced-threshold regression confirms that a comparison whose two feasible
branches each retain 512/1,024 candidates is still approved and released under
standing consent.

## Mechanism

The old firewall priced only the realized private branch. That made its refusal
decision a function of the protected result. The correction symbolically forks
each bounded Boolean comparison over `false` and `true`, discards only branches
that are impossible under the current posterior, and requires every remaining
branch to satisfy the same cumulative knowledge limit. Actual posterior state
is still committed only when an authorized result is consumed.

## Evidence

- Frozen protocol: `SELECTIVE_REFUSAL_PREREGISTRATION.md`
- Preserved failure: `selective_refusal_failure.json`
  (`4c17a2e2e50b1c2cea2ea4690f7e76f59fba1b73c39ba30518f40a3eb6fb5f6e`)
- Corrected result: `selective_refusal_correction.json`
  (`d40374163594537f3635ef4858ca276b373f76af10215188cde2ebf92442b0aa`)
- Independent deterministic rerun: byte-identical corrected artifact
- Focused tests: 17/17
- Complete repository suite: 306/306

Reproduce:

```bash
node research/pcc-runtime-product/run_selective_refusal_probe.mjs \
  --output /tmp/selective_refusal_replay.json
sha256sum /tmp/selective_refusal_replay.json
node --test test/private-constraint-kernel.test.js
npm test
```

## Claim boundary

This closes the tested standing-consent selective-refusal oracle for analyzable
bounded-integer comparisons and bundles of at most four Boolean comparisons.
It is deliberately conservative: one unsafe feasible branch denies the whole
query, even when the actual branch would be harmless. It does not establish
semantic privacy, correctness of declared domains, resistance to malicious
trusted contracts, timing-channel safety, or privacy for general programs.
