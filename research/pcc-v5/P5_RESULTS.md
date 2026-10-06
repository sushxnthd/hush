# PCC v5 × POLAR-Bench P5 confirmatory result

Status: **FAILED preregistered confirmation. Preserved without retuning.**

## Frozen provenance

- Preregistration: `research/pcc-v5/P5_PREREGISTRATION.md`
- PCC v5 compiler freeze: `5f6751ffa8f9e62a33a26900ffb08fd18e31ff84`
- Evaluator/workflow commit: `1278c2c465e362f5db99179c30d4bf38dc829f6f`
- GitHub Actions run: `37399149003`
- Dataset: `Qiaoyuan/POLAR-Bench`, `data/privacy_benchmark_rendered_repaired.json`
- Dataset revision: `2fe6a18ac50ab86c64b2e5935031901ca35a2d18`
- Dataset SHA-256: `b1db0274228b1346df47d0a42bb75f9536ded1a6d750bb2720f43612c7abb266`
- Confirmatory subset: privacy level 5, `conflicting_constraints`, 1,568 cases
- Artifact ID: `11383982903`
- Artifact ZIP SHA-256: `0cae8fe98a04d3f9559658bfe79d347de645366353ac9ff8c4cb5f11c5580b6c`
- Reproduced discrete-output SHA-256: `4915d85672e3e9a9f881d83080df458fce828711b5025b470ace76c562c15dbe`

## Results

| Arm | Privacy | Utility | Overall | Protected values disclosed | Leak-free cases | Minimal success |
|---|---:|---:|---:|---:|---:|---:|
| Raw context | 0.084928 | 0.931530 | 0.508229 | 10,407 / 11,352 | 0.0000 | 0.0000 |
| Lexical filter | 0.595796 | 0.866676 | 0.731236 | 4,807 / 11,352 | 0.146046 | 0.040179 |
| PCC v5 | **1.000000** | **0.863010** | **0.931505** | **0 / 11,352** | **1.000000** | **0.699617** |

Paired exact joint-success comparison:

- PCC-only wins: **1,037**
- Lexical-only wins: **3**
- Exact two-sided sign-test p-value: **3.1826236273583514e-305**

Two deterministic executions produced identical discrete outputs.

## Frozen gates

| Gate | Result |
|---|---|
| Zero protected disclosure | PASS |
| Mean utility >= 0.95 | **FAIL** |
| Overall >= 0.975 | **FAIL** |
| Minimal success >= 0.90 | **FAIL** |
| Architecture advantage >= 0.10 | PASS |
| Paired significance p < 0.01 | PASS |
| No utility collapse vs lexical | PASS |
| Domain/attack breadth | **FAIL** |
| Blinding integrity | PASS |
| Exact reproducibility | PASS |

**Overall: FAIL.**

## Interpretation

PCC v5 completely eliminated the benchmark's exact protected-value disclosures on the untouched conflicting-constraints regime and substantially improved exact joint success over lexical filtering, but it did not preserve enough required information to clear the preregistered utility, overall, joint-success, and breadth thresholds.

P5 is therefore permanently recorded as a failed confirmation for PCC v5. It may be used only as development data for a later mechanism. Because POLAR privacy levels 1–5 have all now been consumed, any new *fresh confirmatory* claim must use a different untouched external benchmark or independent third-party reproduction.

This result does **not** justify claims of universal privacy, semantic-inference privacy, independent reproduction, or universal superiority over competing systems.
