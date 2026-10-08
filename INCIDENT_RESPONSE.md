# Hush incident response

This is an operational runbook for early access. It is not evidence that an incident drill, independent review, or staffed support SLA has been completed. Before broad production launch, designate an incident lead and backup, verify a private reporting channel, and exercise this runbook with recorded results.

## Intake and ownership

Use the reporting route in [SECURITY.md](SECURITY.md). Keep credentials, private context, recovery phrases and exploit details out of public issues. Assign one incident lead for each incident and record the affected versions, UTC timeline, scope, containment decisions and evidence identifiers in a private incident record. Record who can approve rollback and who communicates with affected users; do not assume these roles are staffed.

Treat suspected plaintext disclosure, reusable credential exposure, approval bypass, compromised served JavaScript, signing-key compromise or damaged encrypted state as urgent. First establish whether the browser workspace, native runtime, a provider account or release infrastructure is affected.

## Contain and preserve evidence

1. Preserve the affected build's commit, artifact digest, workflow run and privacy-safe error details. Retain encrypted state separately before attempting repair. Do not upload user stores to public CI or ask users to provide their passphrases.
2. For a browser code compromise, stop serving the affected workspace build or publish a verified safe notice. An affected unlocked page can read plaintext; encryption at rest does not undo that exposure. Ask affected users to close the page, review their clipboard and revoke any exposed provider credentials through the provider's own controls. Preserve browser data until a verified recovery path is available; clearing storage can permanently lose it.
3. For a runtime authority or credential incident, stop the affected local runtime and agent access. Disconnect affected providers and revoke credentials at the provider. Preserve receipts and encrypted state. Do not relax client authentication, origin checks, grant scope or production key-store requirements to restore availability.
4. For a supply-chain incident, suspend affected artifact distribution and automated promotion. Revoke compromised publisher credentials or signing keys using their issuers' supported controls. A previously published checksum alone does not establish trust after the publishing channel is compromised.

## Repair and rollback

Select a known safe source commit and verify the change that caused the incident. Rebuild rather than trusting affected outputs. Review data-format compatibility before deploying older code. Do not restore older grant/revocation state merely to recover availability: this can re-enable expired authority or reset use counters.

Use `npm run ops:rollback` to exercise synthetic snapshot restoration and tamper rejection. Use `npm run ops:recovery` and the cross-machine recovery workflow to exercise supported recovery into fresh state. These commands are rehearsals; they do not repair a user's existing directory. Browser backup restoration requires the original passphrase and replaces active browser data only after confirmation. Do not treat an old browser backup as the latest state.

For the website, build with `npm run site:build` and verify with `npm run site:verify` before deploying a reviewed safe commit. The build gives JavaScript and CSS content-specific URLs so an updated document requests the matching release assets. Previously opened pages can still run old code; affected users should close them and reopen the verified release.

Before resuming release promotion, run the unit suite, `npm run launch:smoke`, release build/verification and the relevant recovery/rollback checks. Exercise a regression for the incident trigger. For durability defects, run `npm run ops:soak`; the smoke result is not a completed 72-hour validation.

## Communication and closure

The incident lead records confirmed affected versions and data/actions, current containment, required user steps and the next update time. Distinguish confirmed exposure from an investigation. Publish notices through the project's release/security and support surfaces; never include user private records or reusable secrets. Determine any notification obligations with the responsible operator and legal adviser.

Close only after the fix and recovery path are verified and residual risk is documented. Retain a redacted timeline, regression evidence, rollback result, accountable owner and follow-up actions. An `incident-drill.json` production attestation may be issued only after a real owner-led exercise with checkable evidence; the existence of this document is insufficient.

## Durability validation

`npm run ops:soak` creates an isolated synthetic fixture and kills a child process at five write boundaries for each of encrypted context, vault, authority state and signed receipts. Restart checks require all acknowledged writes, the revoked sentinel and a valid signed chain to survive. Interrupted writes may resolve to either complete old or complete new state. Test processes cannot invoke system credential-store commands.

The `soak-72h` workflow offers a two-runner smoke and a full run: 24 sequential three-hour segments transfer the same synthetic fixture and reject missing segments or changed source commits. The existing `production-soak` environment protection remains in effect. Completion requires at least 72 hours of accumulated active testing, 72 hours of wall time and all 20 crash boundaries. Queue time does not count as active testing. Artifact state contains test-only synthetic key material, never user data. This simulates process crashes, not physical power loss or all OS/storage failures. Do not mark the reliability attestation as passed while a run is incomplete.
