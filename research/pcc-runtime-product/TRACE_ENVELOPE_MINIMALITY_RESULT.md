# Trace envelope is the least prefix-safe finite-ensemble ledger

**Classification:** EXACT THEOREM / RUNTIME-DESIGN CORRECTION  
**Status:** PASS  
**Breakthrough gate:** INCONCLUSIVE pending expert priority review and external use

## Smallest supported claim

For any realized nonnegative risk matrix `R_p(s)`, define a scalar prefix-safe ledger as a
nondecreasing sequence `L_t` satisfying `L_t >= R_p(s)` for every ensemble member `p` and
every observed prefix `s<=t`. Then

`A_t = max_{p,s<=t} R_p(s)`

is the unique pointwise least prefix-safe ledger. The independent-step charge

`Q_t = sum_{j<=t} max_p (R_p(j)-R_p(j-1))_+`

is prefix-safe but satisfies `Q_t>=A_t`, so it can never authorize a release that `A_t`
rejects at the same threshold.

For member oracle risk `O_p=max_s R_p(s)` and budget `b`, the false-denial difference is exactly

`FD_Q(p,b)-FD_A(p,b) = 1[A_t <= b < Q_t]`.

The utility gap is therefore controlled by a tie-invariant scalar interval, not by which prior
member wins an `argmax`. Inside the certified finite-ensemble model, switch-potential routing is
unnecessary: the trace envelope weakly dominates independent-step accounting on every transcript.

## Proof

Every prefix-safe `L_t` upper-bounds every value in `{R_p(s): p, s<=t}` and hence their maximum
`A_t`. The sequence `A_t` itself is nondecreasing and upper-bounds the same set, so it belongs to
the safe class and is its pointwise minimum.

With `R_p(0)=0`, each `R_p(s)` is at most the sum of its positive increments; replacing each
member increment by the stepwise maximum and summing gives `R_p(s)<=Q_s<=Q_t`, hence `A_t<=Q_t`.

Because `O_p<=A_t<=Q_t`, the two threshold decisions differ exactly when `A_t<=b<Q_t`; in that
case `O_p<=b`, so the extra denial by `Q` is necessarily false. In all other orderings both ledgers
make the same allow/deny decision or deny together, proving the indicator identity.

## Decisive evidence

| Check | Result |
|---|---:|
| Risk matrices exhausted | 270,756 |
| Prefixes checked | 807,732 |
| Safe monotone ledgers compared | 3,572,783 |
| Exact admission/false-denial identities | 19,279,392 |
| Primary counterexamples | **0** |
| Independent deterministic cases | 7,680 |
| Independent checks | 3,035,520 |
| Independent failures | **0** |
| Online HUSH unit tests | 2/2 PASS |

- Primary canonical SHA-256: `f9d35d5fbb3b0e09426b1424e79292ef5e8de4067eb1e38cdd762b1fbeffc399`
- Independent audit digest: `cf8652cd86b99950c6f446b889cd04082762067257d7750c15c2af6ec8caec3a`

## System consequence

The new `TraceEnvelopeLedger` updates online as
`A_t=max(A_(t-1), max_p R_p(t))`. It retains one scalar regardless of ensemble size. The
independent-step implementation must additionally retain the previous risk vector, using `m+1`
scalars for `m` members. Both perform `O(m)` work per disclosure step.

HUSH should therefore retire utility-based switch routing. The actual runtime gate is whether a
versioned finite ensemble and its risk definition are trusted and applicable. When that gate passes,
use the trace envelope. When it does not, fail closed or use the separately justified universal
accountant; do not infer safety from this theorem.

## Failure mining

The earlier router failed because single-winner identity is not stable under ties. That failure did
not reveal a better classifier; it exposed that classification was solving the wrong problem.
Material benefit varies by family, but `A` has no safety, authorization, time-complexity, or state
disadvantage relative to `Q` within the model. Zero-gain families simply produce `A=Q`.

## Prior-art boundary

Adaptive privacy odometers and filters are established, including distinctions between online loss
tracking and stopping rules. Realisation-level privacy filtering is also active prior art. This HUSH
result is not a differential-privacy composition theorem and makes no novelty claim over that body of
work. Its supported contribution is the exact minimality/decision law for HUSH's finite-ensemble
realized min-entropy-risk ledger and the resulting runtime simplification. Historical priority for
this exact formulation remains unverified.

- Rogers, Roth, Ullman, Vadhan, *Privacy Odometers and Filters: Pay-as-you-Go Composition*:
  https://arxiv.org/abs/1605.08294
- Taylor, Vippathalla, Coon, *Realisation-Level Privacy Filtering*:
  https://arxiv.org/abs/2604.08630

## Two ledgers

### SCIENCE

- **KNOWN:** `A` is the pointwise least scalar prefix-safe ledger for the specified realized matrix.
- **KNOWN:** `FD_Q-FD_A` equals the tie-invariant gap-interval indicator exactly.
- **FALSIFIED:** worst-member switch identity is needed to decide between `A` and `Q`.
- **ANOMALOUS:** the failed router was unnecessary even where it appeared descriptively predictive.
- **UNTESTED:** ensemble misspecification, evolving prior sets, and non-min-entropy risk definitions.

### CONSEQUENCE

- Retire switch-potential utility routing.
- Use `TraceEnvelopeLedger` whenever the finite-ensemble applicability certificate is valid.
- Preserve the universal/fail-closed path when that certificate is absent.
- The next kernel is ensemble-validity certification under prior shift, not another utility router.

## Limitations

This is conditional safety relative to the supplied ensemble and risk metric, not semantic privacy,
differential privacy, or universal leakage protection. It does not establish ensemble coverage and
does not cover timing, covert channels, malicious priors, or arbitrary unstructured disclosures.

## Reproduction

```bash
python3 research/pcc-runtime-product/verify_trace_envelope_minimality.py \
  --output /tmp/trace-envelope.json
python3 research/pcc-runtime-product/audit_trace_envelope_minimality.py \
  /tmp/trace-envelope.json
node --test test/trace-risk-ledger.test.js
```
