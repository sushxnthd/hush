# Hush Privacy Notice

_Last updated: October 7, 2026_

Hush is designed as a user-controlled trust layer between you and AI systems. Its default architecture keeps private context, credentials, provider tokens, consent rules, and authority state on your device and attempts to disclose only the minimum information needed for a task.

## What Hush stores locally

Depending on the features you use, Hush may store encrypted private context, OAuth tokens, connector snapshots, consent and trust rules, action approvals, disclosure history, signed receipts, recovery material, and device/sync metadata. Private values are encrypted at rest. Production builds use the operating system credential store for the local root key where supported and refuse an unprotected plaintext-key fallback unless it is explicitly enabled.

## Connected services

Hush only requests provider permissions you select. Google permissions can include bounded read access to Gmail metadata/snippets, Calendar events, Drive file metadata, Contacts, Gmail sending, or Calendar event creation. GitHub connection uses device authorization. Provider credentials remain in Hush's local encrypted vault and are not intentionally placed into AI model context.

When you ask Hush to perform a provider action, the relevant provider receives the information required to perform that action. For example, Google receives the recipient, subject, and body of an email Hush sends through Gmail. The provider's own privacy terms apply to that processing.

## AI disclosure

Hush is built to minimize what external AI systems receive. Depending on the task and your policy, Hush may return a derived answer, coarse value, approved abstraction, or exact value. Hush also tracks cumulative disclosure and can require approval or refuse a release. No technical system can guarantee that all possible semantic inference, provider behavior, endpoint compromise, or side channel is eliminated; Hush's published research and benchmark claims are limited to the evaluated threat models and datasets.

## Sync and recovery

If you enable Hush sync, sync payloads are ciphertext and signed before transfer. Recovery kits are designed to rewrap encrypted state without including plaintext private records. You are responsible for protecting recovery phrases and access to your devices.

## Product telemetry

The Hush core does not require analytics or advertising telemetry to operate. Release artifacts should not contain ad SDKs or third-party analytics SDKs. If hosted web surfaces, crash reporting, update infrastructure, or optional diagnostics are introduced, this notice must be updated before those systems collect production user data.

## Website and support

Public web hosting and GitHub may receive ordinary network metadata such as IP address, browser information, and request logs under their own policies. If you submit a support issue, message, diagnostic package, or security report, the information you choose to include is processed to respond to that request. Do not include passwords, OAuth tokens, recovery phrases, or unnecessary private context in support requests.

## Selling data and advertising

Hush does not sell user personal data or private AI context to advertisers. Hush does not use private vault contents to target advertising.

## Retention and deletion

Local Hush data remains on your device until you remove it, disconnect a provider, revoke authority, reset Hush, or uninstall/remove the data directory. Provider-side copies created by an action, such as a sent email or calendar event, must be managed with that provider. Support records and public GitHub reports may persist according to the service hosting them.

## Security

Hush uses encrypted local storage, scoped credentials, signed receipts, explicit approval boundaries, recovery controls, and release integrity checks. Security issues should be reported using the process in `SECURITY.md` rather than a public issue when disclosure could put users at risk.

## Changes

Material privacy changes should be documented in this notice before or when the changed behavior reaches production. The repository history records revisions to this file.

## Contact

For general support, use the channels listed in `SUPPORT.md`. For security reports, follow `SECURITY.md`.
