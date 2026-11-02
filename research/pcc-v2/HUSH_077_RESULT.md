# HUSH-PCC-077 | Post-crash retry of a provider-accepted operation

Date: 2026-11-02. Secondary Hush workstream. Frozen protocol commit `9537d6189d900576c9fb828cd3876058111e7db7`. **Evidence status: EXECUTABLE TEST AND INDEPENDENT REPLAY COMMITTED; HOSTED TEST RESULT PENDING. Do not claim the predicted duplicate has been observed until CI is inspected.**

## Distinct question and prior result
[HUSH-067](HUSH_067_RESULT.md) already demonstrated, on three operating systems, that a provider fixture can commit work after a broker abort or crash. That observation and the standard HTTP ambiguity of non-idempotent retries (RFC 9110 §9.2.2) are **prior art**, not new HUSH-077 novelty: https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2 .

HUSH-077 adds the **durable-state recovery and explicit re-approval step**: after the first HTTP effect and a killed broker, does a restarted broker with the *same open durable authorization transaction* admit a fresh ticket that causes a second identical provider POST? The negative control durably revokes the transaction before retry. This tests the product's recovery boundary, not an authorization bypass. Two approvals for the same logical operation remain two approvals from the broker's perspective.

## Exact reproducible test
- [Node test](../../test/action-broker-crash-retry-077.test.js) uses a real loopback HTTP receiver, a separate OS process, `SIGKILL` only after full first POST body receipt, a persisted encrypted authorization store, broker reconstruction, fresh ticket and explicit approval.
- The positive arm predicts two completed provider POST bodies, one post-restart receipt and **no recoverable first receipt**.
- The negative arm predicts one POST, durable transaction closure, and a rejected post-restart request.
- [Independent Python replay](hush_077_independent_replay.py) rejects missing arms, unexpected fields, mismatched counts and incorrect crash/restart ordering in sanitized Node test logs.
- [Hosted workflow](../../.github/workflows/hush-077-crash-retry.yml) executes the two arms and independent replay on Node 22 / Python 3.12, plus selected existing trusted-enforcement and scope regressions. No external service, paid resource, credential or production integration is involved.

## Predicted release consequence
A broker-local ticket/receipt and an open authorization transaction do not constitute an externally enforced exactly-once operation ID. An accepted-but-unacknowledged provider effect creates an **unknown-outcome state**. The conservative product response is no automatic non-idempotent retry until provider-side idempotency or independent reconciliation is demonstrated. Revocation before retry can prevent a new broker dispatch, but cannot undo the first accepted effect. The test's local fixture is not an independent provider audit.

This is an operational falsification / release-blocker experiment, **not a new information-flow theorem**. HUSH-067's post-crash provider-commit counterexample remains the stronger established prior observation. External provider integration, trusted commit-point mediation, actual crash/restart recovery, cancellation semantics, and external security review remain mandatory before release.

**Status:** CI outcome unverified at report creation; Hush production BLOCKED. Lucent primary branch/PR unchanged; E002-371 still lacks physical/human validation.
