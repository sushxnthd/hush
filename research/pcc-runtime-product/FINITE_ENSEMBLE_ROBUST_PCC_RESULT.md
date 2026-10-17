# Finite-Ensemble Robust PCC — result

## Smallest supported claim

**PASS.** When Hush can bind a bounded-numeric policy to an explicit finite,
provenance-backed ensemble of possible priors, charging the maximum realized
statewise min-entropy reduction over that ensemble is fail-closed for every
covered prior and materially less conservative than the universally sharp
three-log mismatch fallback on the frozen structured families.

This is a coverage-conditional mechanism. It does not infer whether the true
prior belongs to the ensemble.

## Mechanism

For ensemble `P` and observed branch `B`, FER-PCC charges

`E(P,B)=max_{p in P} max(0,L(p,B))`.

The returned deterministic receipt records the charge, worst-case ensemble
member, branch, ensemble size and SHA-256 ensemble digest.

If the true prior is in `P`, `E` cannot undercharge it. If provenance or
coverage is unavailable, Hush must retain the universally sharp
`L(h,B)+3log2(rho)` fallback or deny.

## Frozen prospective evaluation

Untouched deterministic prior families were generated at domain sizes 8, 16
and 32. Every nontrivial contiguous numeric interval was evaluated against six
budgets and four controls.

| Prior family | Universal false denials | FER-PCC false denials | Reduction | FER-PCC false-safe |
|---|---:|---:|---:|---:|
| Translated Gaussian | 9,069 | 2,644 | **70.85%** | **0** |
| Exponential tilt | 8,758 | 1,678 | **80.84%** | **0** |
| Two-mode mixture | 9,389 | 2,364 | **74.82%** | **0** |
| Adversarial tightness control | 627 | 115 | **81.66%** | **0** |

The universal fallback also had zero false-safe decisions, as required. The
comparison isolates utility: both robust policies were safe for the covered
priors, but FER-PCC used ensemble structure instead of paying simultaneously
for incompatible worst-case factors.

Cardinality accounting produced 282 false-safe decisions on translated
Gaussians, 88 on mixtures and 14 on the adversarial control. Nominal prior
accounting produced 1,118, 122 and 6 respectively. These counts describe only
the frozen study.

## Gate and replication status

| Gate | Result |
|---|---|
| Positive normalized priors | PASS |
| Ensemble charge upper-bounds every member | PASS |
| Universal fallback upper-bounds every member | PASS |
| FER-PCC zero false-safe | PASS |
| Universal fallback zero false-safe | PASS |
| Strict FER-PCC improvement in all structured families | PASS |
| >=30% improvement in at least two families | PASS — 3/3 |
| Complete independent decision-table recomputation | PASS — 10/10 configs |
| Byte-identical full rerun | PASS |
| Executable deterministic charge/receipt module | PASS |

## Evidence integrity

- Result SHA-256:
  `cf16b4ef3922174b69d9de4cd97952f61e3fb1d5cd807ca34f15335a14337396`
- Canonical payload SHA-256:
  `75fc755e59432cc3e424d5605400060fab6d20676d913b80e6135f821feeb8e5`
- Independent decision rows SHA-256:
  `2ce910fe86822a15dbfa422d5637d32ff35c57f860093eb022d4be92753001c1`
- Independent audit artifact SHA-256:
  `4ad52bc031a0ca980d847d29a9275b79c0441598e6517320e9e26fb67ad59671`

## Reproduce

```bash
python3 research/pcc-runtime-product/verify_finite_ensemble_robust_pcc.py \
  --output /tmp/fer-pcc-1.json
python3 research/pcc-runtime-product/verify_finite_ensemble_robust_pcc.py \
  --output /tmp/fer-pcc-2.json
cmp /tmp/fer-pcc-1.json /tmp/fer-pcc-2.json
python3 research/pcc-runtime-product/audit_finite_ensemble_robust_pcc.py \
  /tmp/fer-pcc-1.json

node --input-type=module -e \
  "import {finiteEnsembleRobustCharge as f} from './research/pcc-runtime-product/finite_ensemble_robust_charge.mjs'; console.log(f({priors:[[.5,.5],[.25,.75]],branchIndices:[0]}))"
```

## Science and consequence ledgers

### SCIENCE

- KNOWN: exact maximization over a covering finite ensemble is safe for every
  member and can be much tighter than the universally optimal scalar-envelope
  bound.
- FALSIFIED: utility loss from the three-log fallback is unavoidable even when
  additional structured uncertainty information is available.
- STRONGEST ALTERNATIVE: safety is purchased by assuming ensemble coverage;
  out-of-ensemble shift remains unprotected.
- UNTESTED: adaptive posterior updates and cumulative multi-query FER-PCC
  accounting.

### CONSEQUENCE

Hush now has an executable third policy mode:

1. use exact uniform cardinality when that is the declared semantics;
2. use FER-PCC when a versioned provenance-backed prior ensemble is available;
3. use the universally sharp three-log fallback—or deny—when only a scalar
   mismatch certificate is available.

The next decisive action is a frozen adaptive repeated-query study that updates
every ensemble member after each observed branch and tests cumulative
composition, coverage failure and receipt replay.

## Limitations and gate status

The study is synthetic and covers finite ensembles, bounded numeric domains,
contiguous deterministic branches and single-step decisions. It does not
validate ensemble provenance, detect out-of-ensemble shift, cover semantic or
stochastic leakage, establish primary-literature novelty, or demonstrate
external user utility.

The scientific breakthrough gate remains **INCONCLUSIVE**. This is a
reproducible system mechanism with a prospectively confirmed utility advantage,
not yet a complete adaptive-disclosure result.
