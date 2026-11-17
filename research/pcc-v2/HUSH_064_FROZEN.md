# HUSH-064 FROZEN | Durable check/save critical section and fail-closed crash recovery

Date: 2026-10-29. Secondary workstream, existing Hush research branch and draft PR #45. HUSH-063's original counterexample and its unpatched expectations remain historical evidence; this protocol tests a narrow mitigation, **not** a general information-flow theorem or a production release.

## Precommitted mechanism and prediction

For a local encrypted authorization store on one trustworthy filesystem, a process-exclusive lock must cover the entire durable read/validate/write critical section. Acquire an exclusive sibling `.lock` file with atomic create; reject immediately if it already exists. Never auto-break a lock on age, PID, or timeout. Close and unlink it only in a `finally` block owned by the acquiring process. A process crash can leave a lock; recovery is **manual and fail closed**, not an automatic retry that risks split brain. This design assumes the filesystem provides atomic O_EXCL creation and trustworthy local file operations; NFS, hostile local processes, lock-file deletion, shared credentials, and filesystem corruption are outside its guarantee.

Freeze four predictions:
1. During the stale broker's checked-save critical section, a separate process attempting to close `tx` must be denied by `AUTHORIZATION_STATE_LOCKED`, rather than racing through to an overwritten closure.
2. Once the stale write releases the lock, a separate process can close `tx`; a fresh broker then rejects re-registration and cannot use that closed authorization.
3. If the closure commits **before** the stale writer acquires the lock, the stale writer must reject its write as `AUTHORIZATION_STATE_STALE_WRITER_CONFLICT`.
4. A preexisting lock, including one left by a crashed process, must prevent all persistent mutations; never silently clear it or use an in-memory fallback.

## Independent checks and limits

Exercise real separate Node OS processes, encrypted state on disk, and an actual loopback HTTP adapter. Keep the original HUSH-063 counterexample documented; change its executable to assert the new denial rather than continue asserting a vulnerability after mitigation. Verify the no-race control. Add a dedicated lock-collision/crash-artifact regression and CI. Do not claim safety against cancellation, already-dispatched provider effects, revocation versus execute races, filesystem adversaries, or all observable timing channels. Product release remains BLOCKED until these are addressed and externally reviewed.

No changes to Lucent, no force push, no merge.