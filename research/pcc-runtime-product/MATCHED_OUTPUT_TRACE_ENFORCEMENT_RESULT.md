# Matched-output trace enforcement: exact result

Date: 2026-10-16  
Protocol: `MATCHED_OUTPUT_TRACE_ENFORCEMENT_PREREGISTRATION.md`  
Status: **all frozen finite and runtime gates passed locally; repository CI pending**

## Smallest supported claim

For read/action allow-set policies, an admission verifier that observes only an intended public output cannot be both sound and complete whenever that output has both an authorized and unauthorized realization. A monitor that sees each internal read/action before dispatch classifies the same policy exactly. Hush now has an experimental fail-closed pre-dispatch monitor with hash-chained attempted-event receipts; its denied-event callback was never invoked in the frozen tests.

This is an assurance mechanism result, not a privacy-utility advantage. It does not establish project-wide complete mediation, and it does not claim novelty for the generic reference-monitor theorem.

## Exact propositions

### Proposition 1: matched-output impossibility

Let `Safe(t)` be a trace-safety predicate and let `pub(t)` be the intended public output. If there are traces `s,u` with `Safe(s)`, not `Safe(u)`, and `pub(s)=pub(u)=y`, then no verifier `V(y)` is both:

- complete: it admits every safe trace; and
- sound: it admits no unsafe trace.

**Proof.** Completeness on `s` requires `V(y)=allow`. Soundness on `u` requires `V(y)=deny`. Because the verifier receives the same `y`, both requirements cannot hold. ∎

### Proposition 2: exact incremental enforcement

For a policy `(R_allow,A_allow)`, define a trace as safe iff every read name is in `R_allow` and every action name is in `A_allow`. An incremental monitor that denies at the first nonmember event is sound and complete for this finite-trace safety property.

**Proof.** If the monitor allows the whole trace, each read/action passed the corresponding membership test, so the trace is safe. If the trace is safe, every event passes, so the monitor allows it. ∎

The two propositions locate the capability boundary: the extra enforcement power comes from observation and control of the internal event trace. It does not come from PCC syntax or from calling one verifier “semantic.”

## Frozen audit result

The primary verifier enumerated all allow-set policies, incidence traces, and binary intended outputs for 1–4 resources and 1–3 actions.

| Quantity | Exact result |
|---|---:|
| Classified policy/trace/output instances | 57,120 |
| Policy/output fibers | 840 |
| Fibers with both safe and unsafe traces | 816 |
| Safe/unsafe matched-output trace pairs | 560,064 |
| Sound-and-complete output-only verifiers | 0 |
| Incremental-monitor mismatches | 0 |
| Full-trace semantic-control mismatches | 0 |

The 24 non-mixed fibers are exactly the two outputs for the all-allowed policy in each of 12 `(resource count, action count)` shapes. An independently written formula audit reproduced all four aggregate counts exactly.

## Runtime result

`src/trace-policy-monitor.js` adds:

- exact per-event read/action authorization;
- pre-dispatch `execute(event,effect)`, which does not call `effect` after denial;
- default fail-closed locking after the first denial; and
- receipts whose hashes bind sequence number, predecessor, attempted event, decision, and reason.

The focused runtime suite passed 4/4 tests. The repository-wide suite passed 337/337 tests. Tests covered matched intended outputs with different hidden reads, the full-trace semantic control, post-denial lockout, callback non-dispatch, valid receipt chains, and event/decision/predecessor tampering.

Receipt tamper evidence relies on SHA-256 collision resistance. The test demonstrates detection for the frozen mutations; it is not a cryptographic proof against all adversaries.

## Strongest matched controls

| Control | Result | Interpretation |
|---|---|---|
| Output-only Boolean verifier | 0 sound-and-complete maps | Intended output lacks the needed trace fact. |
| Static allow-set predicate | Exact match | The monitor implements the declared policy, not a different one. |
| Full-trace semantic verifier | 0 disagreements | No Hush/PCC advantage remains after matching observations. |
| Independent formula audit | Exact count match | Primary enumeration arithmetic reproduced independently. |
| Existing repository tests | 337/337 pass | Experimental module did not regress tested behavior. |

## Prior-art collision audit

The generic theorem is squarely inside established execution-monitor/reference-monitor theory:

- F. B. Schneider, *Enforceable Security Policies* (ACM TISSEC 3(1), 2000), characterizes policies enforceable by mechanisms that monitor execution and stop a violating step: <https://doi.org/10.1145/353323.353382>.
- Bauer, Ligatti, and Walker, *More Enforceable Security Policies* (2002), expands the runtime-enforcement boundary: <https://www.cs.princeton.edu/~dpw/papers/more-enforceabletr.pdf>.
- Capobianco et al., *ACCESSPROV* (TaPP 2017), makes the implementation consequence concrete: complete mediation requires an authorization hook before every security-sensitive operation, and missing hooks create ambiguity: <https://www.usenix.org/system/files/conference/tapp2017/tapp17_paper_capobianco.pdf>.

Therefore the defensible result is not “a new reference-monitor theorem.” It is the exact collision that kills any Hush claim based on final-output checking alone, plus a checkable Hush runtime primitive and receipt contract that implement the required observation boundary.

## SCIENCE ledger

- **Survives:** Output-only admission is provably insufficient on every nontrivial frozen policy/output fiber.
- **Survives:** Incremental trace monitoring and the full-trace semantic control exactly classify all 57,120 enumerated instances.
- **Falsified as a differentiator:** “Semantic verifier” versus “Hush/PCC monitor” has no residual difference once both receive the full trace.
- **Prior-art boundary:** Generic monitor enforceability and complete mediation are established; no novelty claim is made for them.
- **Wildcard probe:** Per-event non-locking mode produced no classification anomaly. It remains available only as an explicit control; the runtime default stays fail-closed.

## CONSEQUENCE ledger

- Hush may claim assurance only for paths whose security-sensitive reads/actions are mediated before dispatch.
- A receipt for the final released value cannot certify access/action compliance. Assurance receipts must bind the complete attempted-event chain.
- The experimental monitor changes the available runtime capability, but product-wide assurance remains blocked until every external effect path is routed through a non-bypassable monitor.
- Existing MCP exact-approval forwarding already follows the same pre-dispatch shape; future integration should unify its receipts with the attempted-event chain rather than invent a second assurance vocabulary.

## Limitations and next decisive action

The finite audit abstracts traces to incidence sets, so it does not cover history-dependent policies, concurrency, reordering, or covert channels. The new module is not yet proven non-bypassable across Hush: native MCP tools, connector actions, model calls, and future adapters must be inventoried and instrumented. The next decisive test is a whole-runtime mediation audit that enumerates every external-effect call site and fails CI if any lacks a monitor hook and receipt edge.
