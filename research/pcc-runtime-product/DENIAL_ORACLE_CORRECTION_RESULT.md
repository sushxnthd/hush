# PCC pre-approval denial-oracle correction

## Smallest supported claim

For the tested bounded integer equality query, PCC preparation no longer reveals
whether the private result passes or exceeds the realized-posterior firewall.
Both worlds return the same approval-bound observation. If the user explicitly
approves a release that the firewall withheld, consumption returns a generic,
one-shot denial without the result or result-dependent metadata.

## Frozen counterexample

The unchanged probe compares two private worlds over the integer domain
`0..1023` with public query `secret == 500`:

| Private world | Before correction | Information exposed before approval |
|---|---|---|
| `secret = 500` | `inference-denial` exception | Equality is true |
| `secret = 501` | prepared with `decision: ask` | Equality is false |

The firewall was enforcing the intended eight-bit posterior limit, but its
result-dependent control flow made the denial itself an oracle. No approval or
release consumption was required.

Failure artifact SHA-256:
`24e04f4a53be8aa97103a3b7b6c149c16c4f4ed8ed433a9d11cb37f9d4b50c6e`.

## Correction

Preparation now records the private firewall disposition only inside the
approval-bound transaction and always presents the same safe metadata to the
requesting agent. A withheld transaction cannot be committed directly. After
explicit approval, consumption produces a generic denial, consumes the release,
and commits no posterior observation.

| Private world | Corrected pre-approval observation | Result inferred |
|---|---|---|
| `secret = 500` | prepared with `decision: ask` | No |
| `secret = 501` | prepared with `decision: ask` | No |

Correction artifact SHA-256:
`8651ab9a2e8de64c7dcdc47148d626dd51fc87e737bdc4e407048001c3943282`.
An immediate rerun was byte-identical.

## Verification

- Unchanged differential probe: **PASS**.
- Focused private-constraint tests: **15/15 PASS**.
- Complete repository suite: **304/304 PASS**.
- Denied releases remain approval-bound and one-shot.
- Conflicting-domain validation remains a preparation-time public-schema error.

## Reproduce

```bash
node research/pcc-runtime-product/run_denial_oracle_probe.mjs \
  --output /tmp/denial_oracle_replay.json
sha256sum /tmp/denial_oracle_replay.json
node --test test/private-constraint-kernel.test.js
npm test
```

## Boundary

This establishes response-level indistinguishability only for the tested
bounded equality case before explicit approval. It does not establish timing
side-channel safety, semantic privacy, arbitrary-program noninterference,
protection under standing prior consent, or resistance to covert channels.
The broader breakthrough gate remains **INCONCLUSIVE**.
