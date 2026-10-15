# Floor-certified branch bound: preliminary priority audit

**Audit date:** 2026-10-15  
**Status:** no exact-formula collision found; historical novelty remains UNTESTED

## Search target

The exact per-realized-branch law

```
log2((n-k+1)/(1+(k-1)(n-k)lambda))
```

for deterministic finite branches under the credal constraint `p_i >= lambda`.

## Closest primary literature found

- Geoffrey Smith, *On the Foundations of Quantitative Information Flow*,
  FoSSaCS 2009, establishes min-entropy/Bayes-vulnerability QIF:
  https://doi.org/10.1007/978-3-642-00596-1_21
- Koenig, Renner and Schaffner, *The Operational Meaning of Min- and
  Max-Entropy* (2008), establishes the guessing-probability interpretation:
  https://arxiv.org/abs/0807.1338
- Liu et al., *Information Leakage in Zero-Error Source Coding: A
  Graph-Theoretic Perspective* (2021), studies source-distribution-maximized
  guessing leakage:
  https://arxiv.org/abs/2102.01908
- Chatzikokolakis et al., *A Precise Information Flow Measure from Imprecise
  Probabilities* (2012), explicitly handles sets of attacker priors:
  https://arxiv.org/abs/1206.5487
- Alvim et al., *The Science of Quantitative Information Flow* (2020),
  systematizes Bayes vulnerability and gain-based QIF:
  https://doi.org/10.1007/978-3-319-96131-6

## Collision assessment

These sources absorb broad novelty claims for min-entropy leakage, posterior
Bayes vulnerability, maximizing over priors, and credal/imprecise-prior QIF.
The targeted search did not locate the exact sharp closed form for a single
realized deterministic branch under a coordinatewise probability floor, nor
its Hush runtime hierarchy.

Absence from this search is not proof of novelty. Before publication, an expert
must check the imprecise-probability/QIF literature, textbooks, appendices, and
equivalent formulations in robust Bayes analysis.

## Allowed claim

An exact, independently checked Hush accounting law with a preliminary
no-collision audit. Do not claim invention of QIF, min-entropy, robust Bayes,
or credal-set analysis. Do not call it a field-level breakthrough until expert
priority review and a real provenance-backed floor source survive.
