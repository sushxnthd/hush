# HUSH-PCC-058 | Hosted prepatch exploit and postpatch enforcement result

Date: 2026-10-28. Secondary Hush kernel, existing research branch and draft PR #45. Protocol frozen before experiment: [HUSH_058_FROZEN.md](HUSH_058_FROZEN.md). The experiment uses **real ActionBroker code and a real loopback HTTP server**, but a controlled clock, deferred synthetic credential resolver and simulated external provider. No deployed provider was contacted.

## Independent hosted comparison

| Frozen condition | Prepatch run 40679591613 | Patched run 40679628111 |
| --- | --- | --- |
| Ticket expires during awaited credential resolution | Expected and asserted **1 adapter dispatch, 1 HTTP POST, allow** | Asserted **0 dispatch, 0 HTTP POST, deny ACTION_TICKET_EXPIRED** |
| Resolver completes before expiration | 1 allowed HTTP effect | 1 allowed HTTP effect |
| Concurrent second execute while first is awaiting | Second call rejected; first expired call still reaches provider | Second call rejected; expired first call produces 0 effects |
| Ticket already expired before execution | 0 resolver calls, 0 HTTP effects | 0 resolver calls, 0 HTTP effects |

[Prepatch hosted run](https://github.com/sushxnthd/hush/actions/runs/40679591613) **completed successfully** on commit `a0c077a60647b754a3d09886f73c8944e016235b`, where the frozen test explicitly expects the prepatch leak and checks the real loopback receiver's POST count. [Patched hosted run](https://github.com/sushxnthd/hush/actions/runs/40679628111) **completed successfully** on commit `e478ecd7861cd7ec2dd2a0d8038f7add42d644c3`, with the same frozen cases expecting fail-closed behavior. The test's two modes are selected by the workflow environment; a green prepatch run is **proof of the expected counterexample under the test**, not proof that the old code was safe. The hosted job steps for both modes passed.

The defect is a time-of-check/time-of-use authorization gap: checking expiry before `await secretResolver` is insufficient. The patch rechecks ticket expiry before adapter dispatch. The tests demonstrate a direct broker-owned enforcement consequence without claiming a new information-flow theorem.

## Limits and release blocker

The test uses a controlled broker clock, synthetic credentials and local HTTP effects. It does **not** establish protection against clock rollback, process SIGKILL in the narrow post-check/pre-effect interval, delayed external provider side effects, non-cooperative cancellation, DNS/egress bypass, malicious adapters or independent external replay. The post-await check still cannot make an asynchronous external effect atomic with ticket expiration; stronger provider-side idempotency and revocation semantics would be required for such a guarantee. Continue real-process crash/restart and cancellation testing with explicit trust assumptions.

**Production remains BLOCKED** pending end-to-end runtime mediation, cancellation/race coverage, provider egress controls and independent security review. Lucent E002-371 remains the primary workstream and is unchanged. No merge, force push or deployment.
