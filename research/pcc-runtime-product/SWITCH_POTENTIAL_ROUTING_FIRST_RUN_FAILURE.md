# Switch-potential routing: frozen first-run failure

Status: **FAIL — independent reproducibility gate**

Frozen protocol commit: `a7df341d6f0c0ef06bdd44e42145dacc2748fbb9`

GitHub Actions run: `38486737778`

## Smallest supported result

The preregistered single-argmax switch-potential diagnostic is not suitable for
Hush runtime routing as specified. Its primary verifier perfectly separated the
four unopened families, but an independently written implementation disagreed
on switch counts. The disagreement is concentrated in symmetric two-peak
ensembles where the top two one-step risks tie or nearly tie. Because exact
independent agreement was a frozen gate, the study fails and the `0.30` router
is not licensed.

The underlying trace-bound ledger safety result was not contradicted: both
implementations exactly agreed on false-denial totals, and the verifier found
zero prefix-safety or dominance violations.

## Frozen outcomes

| Unseen family | Switch potential (primary) | FD `Q` | FD `A` | Reduction | Primary route |
|---|---:|---:|---:|---:|---|
| student location | 0.790579 | 4,448 | 443 | 90.04% | trace-bound |
| two-peak weight | 0.721088 | 2,441 | 1,436 | 41.17% | trace-bound |
| geometric ratio | 0.000000 | 3,294 | 3,294 | 0.00% | independent-step |
| cosine phase | 0.879742 | 2,806 | 201 | 92.84% | trace-bound |

The primary implementation reported balanced accuracy `1.0`, Spearman `1.0`,
and all of its internal gates passing. Those figures are descriptive only
because the independent gate failed.

## Exact disagreement and failure mechanism

The hosted independent audit returned `FAIL`, with four disagreements. An
opened local replay returned five aggregate disagreement counts. Direct
comparison isolated switch-potential disagreements in four two-peak configs:

| n | query | primary | independent replay |
|---:|---|---:|---:|
| 48 | golden alternating | 0.684211 | 0.705263 |
| 48 | center out | 0.754098 | 0.765027 |
| 96 | golden alternating | 0.703125 | 0.695313 |
| 96 | center out | 0.749340 | 0.733509 |

For the affected `n=48` and `n=96` configurations, 51/469 and 113/955 edge
events respectively had a top-two risk-increment margin below `1e-12`. The
diagnostic chooses one member with ordinary floating-point `argmax`; symmetric
ties therefore make the counted identity switches depend on numerically
irrelevant evaluation details. This is a mechanism failure, not merely an
implementation typo.

The workflow also incorrectly appeared green because the audit command was
piped through `tee` without `pipefail`. The follow-up commit fixes that plumbing
while preserving the first-run artifact and failure.

## Two ledgers

### SCIENCE

- **KNOWN:** on these four new families, `A` and `Q` false-denial totals were
  independently identical across implementations; `A` produced large gains in
  three geometrically non-monotone families and no gain in the monotone family.
- **FALSIFIED:** exact reproducibility of single-winner switch potential.
- **ANOMALOUS:** the coarse high/low classification stayed far from the frozen
  threshold despite tie-sensitive counts, so an invariant set-valued or
  margin-aware geometry diagnostic may exist.
- **UNTESTED:** a preregistered tie-invariant diagnostic predicts gain on new
  ensembles without inspecting decision outcomes.

### CONSEQUENCE

- Do not ship or claim the `argmax`-identity router.
- Keep trace-bound FER-PCC opt-in; its safety claim survives.
- The next decisive experiment must replace member identity with a
  permutation- and tie-invariant quantity (for example, overlap of
  epsilon-maximizer sets), freeze epsilon from numeric error analysis rather
  than outcomes, and test entirely new families. Failure should kill this
  routing line.

## Provenance and reproduction

```bash
python3 research/pcc-runtime-product/verify_switch_potential_routing.py \
  --output switch_potential_routing_result.json
python3 research/pcc-runtime-product/audit_switch_potential_routing.py \
  switch_potential_routing_result.json
```

- Workflow artifact digest:
  `sha256:f262a028887e2af7de2a89282f713f4678a9cacf53162718997f6de2bbaf38f9`
- Result file SHA-256:
  `831fa236b206fedd75d1cdf730a10fb205740f5c4a5a40ff3c8d181983f3e608`
- Hosted audit file SHA-256:
  `06cfdf159bc5899610d272b06da6c8f9abcbea0f95a1df99b0f88f1ec922efb3`
- Canonical result payload:
  `2ff9e11f39f775c41fdbb046051873c2a4c0acb475e11ca73ad90d33f6966f88`

## Limitations

This is a synthetic finite-domain result, not an external benchmark or live
provider evaluation. The large utility reductions are opened outcomes and do
not validate a deployable diagnostic. No historical novelty claim is made.
