# Lifecycle absence-factorization protocol

**State:** frozen before outcome generation  
**Kernel branch:** `breakthrough-engine/transaction-scope-recovery-20261021`  
**Purpose:** extend the surviving transaction-authorization mechanism from value maps to complete discrete lifecycle observables.

## Precise question

For a finite hidden-world contract with transaction authorization `G`, when do individually payload-safe runtime phases compose without leaking through event existence, terminal status, cancellation, race order, or crash/restart recovery?

For phase `i`, write `a_i(w)` for activation and `p_i(w)` for the payload when active. Define the lifted observable

`z_i(w) = BOTTOM` when inactive, and `z_i(w) = (PRESENT, p_i(w))` when active.

The full fixed-phase lifecycle trace is `Z(w)=(z_1(w),...,z_k(w))`.

## Candidate law

`Z` is safe under `G` exactly when every lifted phase `z_i` factors through `G`:

`G(w)=G(w') => z_i(w)=z_i(w')` for every phase `i`.

Payload-only checking is strictly weaker because it compares values only when both executions emit. It treats a missing event as “nothing to check,” although an observer distinguishes absence from presence.

For arbitrary interleavings, phase labels/order are part of the payload; equivalently the complete canonical trace must factor through `G`.

## Frozen exact enumeration

- Worlds: `00,01,10,11`.
- Global authorization: parity.
- Per-phase external alphabet: `BOTTOM, 0, 1`.
- Phase counts: 1, 2, and 3.
- Exhaust every lifecycle trace map that passes the payload-only rule.
- Compare the closed-form lifted-factor criterion with an independent pairwise trace oracle.

Expected algebraic counts, fixed before running:

- payload-only-safe maps per phase: `49`;
- full-safe maps per phase: `9`;
- for `k` phases: `49^k` payload-only candidates and `9^k` truly safe candidates;
- across `k=1..3`: `120099` candidates, `819` safe, `119280` payload-only false accepts.

Any mismatch kills the claimed count or criterion.

## Frozen runtime predictions

Use one trusted finite adapter declaration per scenario and require lifecycle certification at broker admission.

1. Constant payload but secret-dependent event existence: deny before dispatch.
2. Constant result but secret-dependent `allow/error` terminal status: deny before dispatch.
3. Secret-dependent cancellation terminal: deny before dispatch.
4. Secret-dependent race order: deny before dispatch.
5. Secret-dependent crash/restart recovery marker: deny before dispatch, including after a fresh-process restart.
6. Lifecycle trace constant within every authorization fiber: allow with unchanged ordinary result.
7. Missing lifecycle declaration under required certification: deny before credentials or dispatch.
8. Unscoped calls and scoped calls not requesting the new certificate: preserve their existing request hashes and behavior.

## Strongest alternative explanation

The result may be only the elementary fact that a product map factors iff each coordinate factors. The gate therefore requires a concrete Hush runtime consequence: a fail-closed pre-dispatch certificate bound into the ticket/request hash, plus prospective attacks covering cancellation, races, and restart. No novelty is claimed for general noninterference or unwinding theory.

## Independent check

The checker must not import the implementation or primary experiment. It must reconstruct all counts from the raw rows, apply its own pairwise oracle, verify the frozen predictions, and confirm that every denied case has zero adapter dispatches.

## Publishable threshold

- exact iff proof;
- zero oracle disagreements over the full frozen enumeration;
- all eight runtime predictions;
- duplicate byte-identical primary artifact;
- independent audit;
- full repository regression and dedicated hosted reproduction;
- explicit prior-art and dishonest-adapter boundary.

## Product-consequence threshold

The production `ActionBroker` must support opt-in required lifecycle trace certificates and reject missing, changed, incomplete, or authorization-refining declarations before credential resolution or adapter execution. Legacy behavior must remain byte-for-byte compatible when the option is absent.

## Kill conditions

- any exact-count or oracle mismatch;
- any protected unsafe scenario dispatches;
- the safe control is denied;
- legacy request hashes change;
- enforcement depends on post-outcome inspection;
- the mechanism silently accepts a missing declaration.
