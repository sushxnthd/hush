# PCC pre-approval metadata correction

## Verdict

The unchanged frozen probe now **PASSES**. Safe single-release and bundle
metadata are result-independent before consumption.

| Channel | Frozen failure | Corrected replay |
|---|---:|---:|
| Single realized `afterCandidates` | 524 disclosed | Withheld |
| Balanced serialized size | 108 vs 132 bytes | Withheld |
| Bundle realized `afterCandidates` | 300 disclosed | Withheld |
| Unapproved private results recovered | 3/3 | **0/3** |

Preparation still reports the pre-query candidate count, configured maximum
knowledge budget, bundle capacity, and that realized accounting is withheld
until consumption. This preserves useful approval-risk context without
encoding the withheld result. After explicit approval, the consumed output and
receipt may carry its realized accounting because the user authorized that
result release.

## Verification

- Preregistration commit: `7112b95296fdc72b04f7d86693bfb814bdc9cc4e`
- Preserved failure commit: `11c9997f8265dd103ece67d1cc7609e65ca8848c`
- Frozen failure SHA-256:
  `6387be722bbaed07d631b30a062af900134784f6b68970a5e007e34e69fcabb8`
- Corrected replay SHA-256:
  `353fe2633f2f3b50f58c6ccd7dc5d042c9ac4a2d9fa2397399ea047c8644ef2f`
- Second corrected replay: byte-identical
- Focused PCC tests: 15/15 passed
- Full repository suite: 304/304 passed

## Smallest supported claim

Hush's corrected PCC preparation boundary withholds the tested
result-dependent size and realized-posterior metadata until an approved result
is consumed. This closes the tested single and bundled pre-approval inference
channels.

## Boundary

This does not establish timing-channel resistance, protection from a
compromised local runtime, malicious trusted contracts, semantic privacy, or
arbitrary non-metadata side-channel safety.
