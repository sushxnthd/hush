# Hush Support

## General support

For reproducible bugs, feature problems, installation issues, or documentation errors, open a GitHub issue in `sushxnthd/hush` with the smallest amount of information needed to reproduce the problem.

Before reporting a problem:

1. Check that you are using the current supported Hush release.
2. Reproduce the issue without pasting passwords, OAuth tokens, recovery phrases, private context, or provider message contents into the report.
3. Include your operating system, Hush version/commit, the failing feature, and the exact error message when safe to share.
4. If the problem involves a release artifact, include the published artifact/checksum identifier.

## Security reports

Do **not** open a public issue for a vulnerability that could expose user data, credentials, permissions, recovery material, or unsafe agent actions. Follow `SECURITY.md` instead.

## Privacy-safe diagnostics

Hush support should prefer structural diagnostics over raw user data. Safe examples include:

- Hush version and commit
- operating system and architecture
- whether an OS credential-store backend is available
- connector/action name without tokens
- error code and failing stage
- receipt or artifact hashes
- redacted logs

Do not attach Vault contents, decrypted Context Kernel records, OAuth access/refresh tokens, provider payloads containing private information, signing private keys, or recovery phrases.

## Account/provider problems

Google or GitHub authentication can fail because of revoked consent, expired credentials, provider outages, or application configuration. Use Hush's disconnect/reconnect flow before manually handling tokens. Hush support should never ask a user to paste a reusable OAuth token into chat or a public issue.

## Recovery problems

Preserve the affected device and recovery material until the issue is understood. Do not publish a recovery phrase. A successful recovery should be performed into a fresh directory/device state first and verified before old state is destroyed.

## Service expectations

Until a formal support SLA is published, support is best-effort and no guaranteed response or resolution time is promised. Production launch material must not claim an SLA that is not separately documented and operationally staffed.

## Incident status

Material incidents affecting released users should be documented through the project's incident process and release/security channels. The incident runbook is maintained in `INCIDENT_RESPONSE.md`.

## Browser workspace support

Start at https://sushxnthd.github.io/hush/docs/. Workspace data is encrypted in the browser; there is no account recovery or passphrase reset. Export a backup before clearing site storage or restoring another backup. A save conflict means another tab updated the workspace: lock and unlock to reload it. The local runtime and browser workspace have separate stores.
