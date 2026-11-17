# Observable-closure kernel protocol (frozen before outcomes)

## Question

Can Hush certify lifecycle noninterference for an adapter from its declared lifecycle map when the adapter may emit an observable outside the broker-owned trace?

## Threat model

The adapter may be dishonest but cannot mutate broker state. It can preserve every broker-visible input, output, status and declared trace while emitting on an unmediated channel. The global authorization is parity over worlds `00,01,10,11`. External observers may see every modeled channel. Continuous timing, microarchitectural state and host compromise remain outside this finite model unless suppressed by a process boundary.

## Candidate law

For finite worlds `W`, authorization map `G`, and external trace
`T=(T_c)_{c in C}`, a runtime certificate is sound exactly when:

1. every external channel is **closed** by being broker-owned, suppressed to a constant, or independently verified; and
2. the joint closed trace factors through `G`.

If any channel is neither owned, suppressed nor verified, the certificate must abstain. A declaration-only decision rule is unsound: two adapters can have identical declarations and broker-visible behavior while a dishonest adapter emits a private-world-dependent value on the unmediated channel.

## Frozen exact sweep

Enumerate binary maps on the four worlds. For each owned-channel count `k=1..5`:

- each owned channel is restricted to the four parity-factored maps;
- one unowned channel ranges over all sixteen binary maps;
- the legacy declaration-only gate accepts all combinations;
- the closure gate accepts only when the unowned map also factors through parity.

Predictions made before execution:

- declaration-only accepts `21,824` cases;
- `16,368` of those are false accepts;
- closure accepts exactly `5,456` safe cases;
- there are zero closure false accepts and zero closure false rejects.

## Adversarial runtime cases

1. Safe control: declared trace and external sink both factor through parity.
2. Dishonest adapter: same declaration, return value and receipt as the control, but an injected unmediated sink receives the first private bit.
3. Missing closure coverage: fail before credentials or adapter dispatch.
4. Mutation between request and execute: commitment mismatch, fail before dispatch.
5. Independently verified channel with an unsafe realized trace: verifier rejects.
6. Suppressed channel: constant external symbol remains safe.

## Strongest alternative explanation

This is complete mediation plus finite noninterference, not a new general security primitive. The potentially defensible Hush result is narrower: an exact API-level soundness boundary and a concrete abstention rule showing why adapter-authored lifecycle declarations cannot support Hush's protected claim.

## Falsification and kill conditions

Kill or narrow the claim if the legacy gate detects case 2, if closure accepts any uncovered channel, if mutation survives commitment checking, or if any complete safe finite trace is rejected.

## Product consequence

Protected lifecycle mode must not certify arbitrary in-process adapters. Hush may certify only an explicitly configured broker-owned/suppressed/independently-verified channel set, and must return `OBSERVABLE_CLOSURE_INCOMPLETE` before secret resolution or dispatch otherwise. Full hostile-adapter protection requires an out-of-process deny-by-default effect boundary.
