# Hush local-first alpha: externally verifiable release blockers

Status: BLOCKED. This checklist is a release contract, not an assertion of completed testing or external review. Scope is one local brokered HTTP integration only; arbitrary tools, browser extensions, shell commands, network interception, and remote provider integrations are out of scope and disabled by default.

## Acceptance evidence required (record commit, exact command, run URL, OS, outcome)
- [ ] Clean installation from tagged archive on a new machine with no developer credentials; documented Node/runtime version, lockfile and checksum; no manual repository patching.
- [ ] Start with no saved authorization. A test integration request MUST produce zero adapter dispatches and zero loopback HTTP effects. Record broker trace and server-side receipt.
- [ ] Approve a single explicitly scoped context flow; verify one permitted effect and an inspectable local audit record containing purpose, scope, expiry, decision, and redacted result. No raw private result in logs, receipts, hashes, errors, or timing-dependent public metadata.
- [ ] Revoke that flow; a repeat and an in-flight post-revocation dispatch MUST produce zero new effects. Verify adapter-side receipt count, not just API denial.
- [ ] Required certificate with missing transaction ID MUST be denied at request and dispatch (regression for HUSH-074); malformed, expired, cross-transaction and replayed tickets MUST also be denied. Verify real HTTP effects = 0.
- [ ] Low-entropy private-result two-world test: vary a secret bit while holding approved public outputs fixed. Compare response body, headers, status, receipt, log, error and stable metadata. No full-result digest or length oracle (HUSH-059). Treat network timing as an unproven channel unless explicitly bounded.
- [ ] Kill broker before durable approval, after durable approval but before dispatch, during adapter execution, and after effect but before receipt commit. Restart each time; verify no unauthorized effect, no accidental privilege resurrection, and documented at-most-once/duplicate-risk semantics. If exactly-once is not enforceable, expose uncertainty and require operator reconciliation.
- [ ] Race cancellation, expiry and revocation against a blocked adapter at each await boundary. Zero dispatches for any request not authorized at the actual enforcement boundary; count server-side effects.
- [ ] Corrupt/truncate persisted state and simulate disk-full/permission-denied writes. Broker must fail closed without silently reconstructing an allow; document backup and recovery with explicit operator action.
- [ ] Independent replay of append-only audit trail reproduces allow/deny decisions. Tampering and missing records are detected or explicitly marked unverified; no misleading green state.
- [ ] Run regression suite and clean install on two OS environments; attach actual hosted CI and independent tester evidence. External security review and threat-model sign-off required before claiming deployment readiness.

## Threat boundary
The broker can mediate only calls routed through its enforced adapter. It cannot prevent direct calls by a compromised host process, kernel-level interception, malicious extensions, screen capture, covert timing channels, or exfiltration through unmediated network paths. A private result delivered to an authorized consumer can be copied by that consumer. Audit integrity depends on the local host and storage trust assumptions; local administrator compromise is outside this alpha guarantee.

## Release decision
Any failed or unexecuted security-critical checkbox is a blocker, not a warning. Unknown authorization state => deny. Unknown post-crash effect state => abstain and require reconciliation. No public alpha tag or external-user-ready claim until the checklist is satisfied with reproducible evidence. This document does not change Lucent's separate E002-371 research workflow.
