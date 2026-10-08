# Hush launch readiness

Updated 8 October 2026. Browser workspace: early access. Native runtime: release candidate. This document records evidence and concrete remaining work; it does not certify production readiness.

## Verified

- Website: 13 published routes, versioned local assets, working browser entry point, product walkthrough, setup, research, privacy, security, terms and help.
- Browser workspace: encrypted persistence, note editing, explicit memory approval, exact sharing preview, approved clipboard copy, backup/recovery and idle locking. No model requests or remote connections.
- 253 unit/security tests pass. Hosted Ubuntu, Windows and macOS release-candidate jobs passed at `9f1fdd58804d4436d8c6835aff0c77d8e304f0ca` in [run 37710140951](https://github.com/sushxnthd/hush/actions/runs/37710140951). That run includes packaged boot, inventory/checksums, synthetic recovery, update rollback and crash/restart smoke checks.
- Existing macOS Keychain / Windows DPAPI packaged evidence and fresh-machine recovery evidence remain recorded under `release/attestations/`.
- The true 72-hour run is [37709939901](https://github.com/sushxnthd/hush/actions/runs/37709939901), pinned to `fcaa495b84c50f6edb2da13c3cf2560dfaf9db36`. It is running. Do not issue a pass until its final report demonstrates both 72 hours of active validation and wall time, all 20 crash boundaries, fixture continuity and all required assertions.

## Remaining acceptance work

| Requirement | Concrete completion evidence |
| --- | --- |
| Linux packaged keys | Complete `platform-keystore` on Ubuntu using the isolated D-Bus / synthetic GNOME keyring fixture, as well as current Windows and macOS jobs. Retain backend, no-file-fallback, stable-key and source-commit reports. This covers an unlocked Secret Service session; locked/unavailable stores must continue to fail closed. |
| Google registration | Account owner registers a **Desktop app** client for Hush's local PKCE loopback flow, enables the selected provider APIs, configures Hush consent branding and support/privacy URLs, and completes Google's applicable production verification. Configure `HUSH_GOOGLE_CLIENT_ID`. Review requested connector/action scopes in `src/provider-onboarding.js`; grant only those selected by the user. |
| GitHub registration | Account owner creates the appropriate Hush OAuth registration and enables device flow. Configure `HUSH_GITHUB_CLIENT_ID`. Record the registration, exact granted scopes, disconnect/revocation behavior and successful production onboarding. |
| Real provider E2E | Obtain explicit authorization for the named test recipient and calendar action, then provision test-only credentials through the protected `production-e2e` environment. The existing workflow requires `HUSH_GOOGLE_CLIENT_ID`, `HUSH_GOOGLE_REFRESH_TOKEN` and `HUSH_E2E_EMAIL`. It sends a real email and creates a calendar event. Never dispatch it under a general website approval or copy tokens into reports. |
| Accessible first run | Validate keyboard navigation, screen-reader announcements, focus, contrast, zoom, mobile layout, storage failure and recovery on the exact browser/native artifacts. Static semantics and browser visual checks are partial evidence, not a complete assistive-technology audit. |
| Signed distribution | Account owner provides appropriate Apple Developer ID / notarization access and Windows signing identity through protected signing infrastructure. Build and verify signed installers; retain signatures, notarization results, artifact checksums and update/rollback evidence. Current portable bundles are unsigned. |
| Independent assurance | An independent reviewer reproduces the published privacy protocol and frozen research results and conducts a security/red-team review. Retain reviewer identity, exact source/version, scope, findings, remediation and retest evidence. Agent-authored assertions do not satisfy independence. |
| Operations and support | Assign an accountable incident owner and a staffed private security/support contact, review published notices, and complete the owner-led drill in `INCIDENT_RESPONSE.md`. Retain actual incident/rollback exercise evidence. Publishing documents alone does not establish response capacity. |

## Provider references

- [Google installed-app OAuth](https://developers.google.com/identity/protocols/oauth2/native-app): desktop client type and loopback PKCE flow. Client secret is documented as optional for this flow.
- [GitHub OAuth authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps): device flow must be enabled in app settings; its client secret is not required.
- [Apple Developer ID](https://developer.apple.com/developer-id/): signing and notarization for distribution outside the Mac App Store.

Run `npm run prod:gate` to inspect all ten release domains. Add an attestation only after a completed, checkable result and keep its exact source commit, artifact identity, evidence URL and limitations. See `release/attestations/README.md` and `V1_2_ACCEPTANCE.md` for the acceptance contract.
