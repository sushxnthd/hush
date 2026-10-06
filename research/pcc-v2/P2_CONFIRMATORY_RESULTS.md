# PCC v2 POLAR P2 Confirmatory Results

Status: **PASS**

This report records the first untouched confirmatory evaluation of PCC v2 after development on POLAR privacy level 1 only.

## Frozen provenance

- PCC v2 development commit: `f4c8b98ce3a845cb763bc2b0bf51cc6d4f2c773f`
- Preregistration commit: `beb0125ff4dff33feb3b96be4c989a403693b3f4`
- Frozen confirmatory workflow commit: `1edd4f12a42f1039c8e109795c6d9bbccd425df8`
- GitHub Actions run: `37448931590`
- Confirmatory job: `112220444557`
- Artifact ID: `11404533126`
- Artifact ZIP SHA-256: `5d292438621d21ee7692b5d826620fe6f31c5caa2b2beb92b5ea89cd7d1079aa`
- POLAR release SHA-256: `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`
- Node: 22 on Ubuntu 24.04 GitHub-hosted runner

## Untouched confirmatory subset

Selection rule frozen before scoring: every POLAR record with `metadata.privacy_level == 2`.

Cases: **1,570**.

No P2 content-based filtering, tuning, alias changes, threshold changes, or gate changes occurred after preregistration.

## Results

| Metric | Raw context | PCC v2 |
| --- | ---: | ---: |
| Privacy | 0.000 | **1.000** |
| Utility | **1.000** | **1.000** |
| Overall | 0.500 | **1.000** |
| Protected targets | 11,366 | 11,366 |
| Protected targets revealed | 11,366 | **0** |
| Leak-free cases | 0.0% | **100.0%** |
| Minimal-success cases | 0.0% | **100.0%** |

PCC v2 leak-free Wilson 95% CI: **99.756%–100%**.

PCC v2 minimal-success Wilson 95% CI: **99.756%–100%**.

## Preregistered gates

All 10 gates passed:

1. at least 500 P2 cases: PASS
2. PCC privacy >= 0.95: PASS
3. PCC utility >= 0.90: PASS
4. PCC minimal-success >= 0.90: PASS
5. PCC leak-free rate >= 0.90: PASS
6. privacy gain over raw >= 0.20: PASS
7. utility drop vs raw <= 0.05: PASS
8. PCC protected disclosures <= 10% of raw: PASS
9. scoring targets blinded from release mechanism: PASS
10. deterministic repetition: PASS

## Defensible claim

On an untouched 1,570-case POLAR privacy-level-2 confirmatory subset, PCC v2 preserved the benchmark's full deterministic utility while reducing exact protected-value disclosure from 11,366/11,366 under raw context exposure to 0/11,366. The mechanism was developed only on privacy level 1, preregistered before P2 scoring, evaluated with scoring targets withheld from the release mechanism, and reproduced identically in two deterministic repetitions.

This supports the narrower scientific claim that **policy-aware local compilation can replace raw private-context disclosure with task-sufficient representations without an observed utility loss on this external benchmark regime**.

## Boundaries

This is not evidence of universal semantic privacy. POLAR's deterministic exact-value scorer does not cover every inferential or side-channel leak. The benchmark provides structured source lanes that approximate trusted local schema information, so the result should not be interpreted as proof that arbitrary unstructured private text can always be transformed perfectly. P1 was used for development and is not confirmatory evidence. P2 is an untouched regime within the same external benchmark family, not an independent third-party reproduction. Independent reproduction and cross-benchmark confirmation remain open.
