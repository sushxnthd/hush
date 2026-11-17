# HUSH-069 FROZEN | Cross-process stale commit guard and revocation resurrection

Date: 2026-10-31. Bounded secondary workstream; preserve Hush research branch and draft PR #45. This protocol precedes the executable. No Lucent branch modification by this experiment.

## Hypothesis
HUSH-068's provider-side check uses a single Node event loop and a file-backed read/rename store. Its claim is explicitly limited to single-process ordering. Two independent provider replicas sharing that file can race: a commit replica reads an authorized snapshot, a revoker replica successfully writes revoked=true, and the commit replica later writes its stale snapshot. The irreversible effect may occur after successful revocation and the stale write may resurrect revoked=false. This is a test of the required atomicity boundary, not a new theorem.

## Predeclared adversarial tests
1. Real ActionBroker approves and enqueues a synthetic-credential operation through HTTP to provider replica C. Replica C reads authorization and pauses at a controlled barrier before committing. Independent provider replica R durably writes revocation, then C resumes. Without a shared commit/revoke lock, expect one post-revocation effect and stale-state resurrection. Repeat with two distinct synthetic credentials; never log their values.
2. Negative/control mode: both replicas use a shared exclusive-create lock for the state read/modify/write transaction, and C checks authorization only after the barrier at the effect commit point. Revoke before release => zero effects, revoked remains true. Commit before revoke => one allowed earlier effect, revoked remains true afterward.
3. Crash/restart: kill paused C after R revokes, restart C against the same state, and verify no subsequent effect under the guarded mode. Missing/orphan lock must fail closed, not be silently stolen.
4. Emit sanitized event-order histories and independently replay event-order/effect assertions. Keep no real provider credentials, no non-loopback network, no production security claims. An actual multi-process filesystem lock does not prove crash durability or distributed provider correctness.

## Falsification and enforcement consequence
If stale mode does not exhibit the expected race, preserve negative result and investigate synchronization assumptions. If guarded mode permits a post-revocation effect, preserve as a direct failure and do not claim it prevents the race. Required release invariant: every effect commit and revocation must linearize against the same trustworthy provider authorization epoch, with all replicas and retry paths covered. Without provider support, narrow promise to broker-local suppression. Hush release BLOCKED, external review required.
