# Broker-owned observability closure: result

## Smallest supported claim

For the finite external-channel model implemented here, adapter-authored lifecycle declarations are insufficient for protected Hush execution. A sound certificate must cover every modeled external channel by broker ownership, enforced suppression, or independent verification, and every non-suppressed realized trace must factor through the global authorization.

This is an exact Hush API boundary, not a claim to have invented complete mediation or noninterference.

## Theorem

Let `W` be a finite world set, `G:W->A` the authorized disclosure, and `C` the set of externally visible channels. Let the realized trace be `T(w)=(T_c(w))_{c in C}`.

A closure certificate is sound for this model iff:

1. every `c in C` is broker-owned, suppressed, or independently verified; and
2. for every non-suppressed channel, `G(w)=G(w')` implies `T_c(w)=T_c(w')`; suppressed channels are constant.

Because equality of tuples is componentwise, condition 2 is equivalent to the joint trace factoring through `G`.

### Declaration-only impossibility

Consider any broker decision rule that sees adapter registration, declared traces, request, return value and broker receipt, but not an unmediated channel `u`. Pair:

- `A0`: emits a constant on `u`;
- `A1`: is identical on every broker-visible value but emits a private-world-dependent bit on `u`.

The broker receives identical inputs from `A0` and `A1`, so it must decide identically. Accepting `A0` therefore accepts unsafe `A1`; rejecting both is abstention, not certification. No declaration-only rule can establish full external-trace noninterference against a dishonest adapter.

## Exact frozen sweep

The sweep used four parity worlds, one unowned binary channel, one through five owned channels, and all binary maps. Each owned map was restricted to the four parity-factored maps.

| Owned channels | Legacy accepts | Legacy false accepts | Closure accepts |
|---:|---:|---:|---:|
| 1 | 64 | 48 | 16 |
| 2 | 256 | 192 | 64 |
| 3 | 1,024 | 768 | 256 |
| 4 | 4,096 | 3,072 | 1,024 |
| 5 | 16,384 | 12,288 | 4,096 |
| **Total** | **21,824** | **16,368** | **5,456** |

All frozen predictions matched. Closure had zero false accepts and zero false rejects. The independent checker derived totals from `16*sum(4^k)`, `12*sum(4^k)`, and `4*sum(4^k)`; it did not reuse enumeration decisions.

## Product consequence

`ActionBroker` now accepts observable boundaries only from broker/deployer construction, not adapter registration. Protected requests set `requireObservableClosureCertificate`. The broker:

- snapshots and commits the boundary at request time;
- re-certifies it immediately before credential resolution;
- denies incomplete coverage, unsafe verified traces, nonconstant suppression, and post-approval mutation;
- records the closure decision and commitment in safe tickets and receipts.

This makes absence of evidence an abstention. It does not turn an arbitrary in-process adapter into a sandbox.

## Adversarial falsification

Tests cover:

- uncovered out-of-band channel denied before credentials or dispatch;
- complete safe boundary permitted;
- boundary mutation after approval denied before secret resolution;
- adapter-side attempts to populate the broker-owned boundary ignored;
- unsafe verified private-bit trace rejected;
- nonconstant claimed suppression rejected;
- exact enumeration and independent closed-form replay.

## Limits and threat model

The finite channel inventory is trusted deployer configuration. Host compromise, continuous timing, cache/CPU contention, process memory and undeclared OS effects are not thereby controlled. A dishonest in-process adapter can still create a channel omitted by a dishonest or incomplete deployment inventory. Full hostile-adapter protection therefore requires an out-of-process deny-by-default effect boundary (for example namespace/network/filesystem restrictions) whose observable inventory is owned by the broker.

## Novelty audit

The underlying ingredients are classical complete mediation and noninterference. No novelty is claimed for them. The defensible contribution is the exact countermodel against Hush's former adapter-declared lifecycle gate, the necessary abstention boundary, and its executable pre-dispatch enforcement with mutation binding and independent exhaustive evidence.
