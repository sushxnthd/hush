# HUSH-072 RESULT | Client cancellation versus durable provider commit (pending hosted execution)

Date: 2026-10-31. Frozen before implementation at [HUSH_072_FROZEN.md](HUSH_072_FROZEN.md), commit `77021fc`. Secondary workstream; Lucent E002-371 primary untouched by Hush changes.

## New executable adversary

The actual repository `ActionBroker` is called by a loopback HTTP wrapper. Its adapter sends a POST to a **separately forked OS-process** HTTP provider. The provider pauses after receiving the request; a test client aborts its HTTP connection, and the authorization transaction is durably closed. Only then is the provider released to append an effect to a local JSONL ledger and `fsync` it. The wrapper records the eventual broker decision even if the original client no longer receives it.

Two synthetic private worlds (0 and 1) share the same public authorization; the provider's private-bit-bearing effect is visible to its own observer even if the broker's completion result is suppressed. Controls cover a normal approved request and an unapproved request. Independent Python replay checks the sanitized event order, exact effect counts, denial/result-digest suppression, and five deliberate trace corruptions.

**Pre-registered predictions, not yet observed hosted results:**

| Scenario | Client completion | Provider effects | Broker decision |
| --- | --- | ---: | --- |
| Private world 0, abort + durable close before provider commit | None | 1 | deny, no result digest |
| Private world 1, abort + durable close before provider commit | None | 1 | deny, no result digest |
| Approved normal control | Completed | 1 | allow |
| Unapproved control | Completed | 0 | ask |

The separately forked provider writes and fsyncs a *synthetic local ledger*. That is not an external transaction, independent security review or proof of crash-durable provider cancellation. The test has no process restart or network partition. The test and CI were committed; at report creation **no completed hosted job was independently inspected**, so all table outcomes remain predictions. Do not claim tests passed merely because a workflow was created.

Files: [actual broker test](../../test/action-broker-client-abort-provider-072.test.js), [forked provider](hush_072_provider.mjs), [independent replay](hush_072_independent_replay.py), [cross-OS workflow](../../.github/workflows/hush-072-client-abort.yml).

## Interpretation and release blocker

This is a classical cancellation/commit boundary: closing a client transport does not necessarily cancel a dispatched effect. HUSH-060's post-dispatch result suppression is not provider-effect suppression; a provider may already have observed private information or committed a change. An adapter that ignores cancellation cannot be made safe merely by suppressing the broker's final receipt.

**Enforcement requirement:** a production wrapper must never equate client abort, late broker denial or absent receipt with `NO_EFFECT`. It must mark the operation outcome unknown pending authenticated provider reconciliation, or use independently verified provider-enforced cancellation and durable idempotency semantics. Broker-owned output noninterference does not imply joint egress noninterference. External review and full runtime mediation remain required.

No new general information-flow theorem is claimed. Production `BLOCKED`; PR #45 remains draft/unmerged. If hosted tests fail, preserve the failure and repair the executable before claiming this predicted result.