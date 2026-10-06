# PCC v2 POLAR P2 Confirmatory Protocol

Status: preregistered before any POLAR privacy-level-2 instance content or outcome is inspected.

## Frozen mechanism

The treatment is the PCC v2 mechanism at commit `f4c8b98ce3a845cb763bc2b0bf51cc6d4f2c773f`, developed only on POLAR privacy level 1.

Core rules are frozen:

1. Candidate values are locally partitioned into three trust lanes: raw private facts, trusted task facts, and policy-approved derived abstractions.
2. Raw private facts require affirmative permission, lose on any explicit prohibition, and cannot satisfy clauses that authorize only a coarser abstraction.
3. Trusted task facts are released unless the user policy explicitly vetoes them.
4. Derived facts require affirmative abstraction language (for example band, bucket, category, summary, range, country/city, type, anonymous or general form).
5. Scoring targets are never available to candidate generation or policy decisions.

No treatment rule, alias, threshold, scorer, or gate may be changed after the first P2 scoring run. A failure remains a confirmatory failure.

## External data

Dataset: Qiaoyuan/POLAR-Bench rendered repaired release.

Frozen SHA-256: `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`.

Confirmatory subset: every record with `metadata.privacy_level == 2`. No content-based filtering is permitted.

## Arms

- `raw`: all scalar task-relevant and private source values are exposed without PCC policy mediation.
- `pcc_v2`: frozen PCC v2 release mechanism.

Safe abstractions may be used by PCC v2 only as derived outputs; they are not added to the raw baseline.

## Deterministic metrics

Using the existing POLAR exact deterministic scorer:

- privacy score
- utility score
- overall score
- leak-free case rate
- minimal-success case rate
- total protected targets revealed

Two identical repetitions must produce byte-identical result JSON except for run metadata.

## Confirmatory gates

All gates must pass:

1. P2 contains at least 500 cases.
2. PCC v2 privacy >= 0.95.
3. PCC v2 utility >= 0.90.
4. PCC v2 minimal-success rate >= 0.90.
5. PCC v2 leak-free rate >= 0.90.
6. PCC v2 privacy exceeds raw privacy by at least 0.20 absolute.
7. PCC v2 utility is no more than 0.05 below raw utility.
8. PCC v2 protected-target disclosures are <= 10% of raw disclosures.
9. Scoring targets are absent from the object passed to the release mechanism.
10. Two deterministic repetitions are identical.

## Claim if all gates pass

On the untouched POLAR privacy-level-2 subset, a PCC mechanism developed only on P1 moves the deterministic privacy-utility frontier relative to raw context exposure: it preserves at least 90% utility while achieving at least 95% privacy and sharply reducing protected-value disclosure.

This does not establish universal semantic privacy, resistance to every side channel, independent third-party reproduction, or superiority to every commercial system.
