# Hush production launch checklist

**Scope:** native runtime release candidate and browser workspace  
**Status:** operational checklist; a checked item is not evidence until the linked artifact and reviewer are recorded.  
**Last updated:** 9 October 2026

The strict gate is intentionally conservative. It accepts source-bound evidence only when the validation actually completed against the candidate commit. Do not mark a release domain complete from code presence, a planned test, or an expired artifact.

## Release domains

| Domain | Required evidence | Current state | Next action |
|---|---|---|---|
| Privacy / minimization | Independent reproduction of the frozen privacy package | Blocked | Recruit an independent reviewer; provide pinned commit, protocol, seeds and raw redacted outputs |
| Keys / local security | Fresh packaged Linux, macOS and Windows keystore evidence | Evidence refreshed | Re-run before release if artifacts expire |
| OAuth / connectors | Google production registration and GitHub production app registration, least privilege and revocation | Blocked | Create production registrations, verify domains/consent, test revoke and re-auth with protected credentials |
| Real actions | Gmail/Calendar/GitHub provider-backed E2E through Hush | Blocked | Run disposable-account tests; capture approvals, receipts, redaction and provider-side outcomes |
| Reliability | Current-candidate 72-hour active/wall-time soak, at least 20 crashes and complete coverage | Blocked | Run the scheduled soak against the exact release candidate and retain the report |
| Recovery | Fresh-machine ciphertext-only recovery across supported OSes | Evidence refreshed | Re-run before release if retained artifacts expire |
| Accessibility / usability | Keyboard, screen reader, focus, contrast, zoom, first-run, storage failure and recovery audit | Blocked | Perform a blinded audit on browser and native onboarding; retain issue list and rerun results |
| Distribution / updates | Signed Windows/macOS artifacts, macOS notarization, update failure and rollback, SBOM/checksums | Partial | Complete signing/notarization and verify on clean machines; current portable artifacts are unsigned |
| Security / operations | Independent security review plus incident and rollback exercise with accountable owner | Blocked | Name owner, run tabletop and technical exercise, commission external review |
| Independent validation / legal | Independent reproduction, current privacy/terms/support surfaces, incident ownership | Partial | Obtain independent reviewer; keep policies current; publish staffed contact/SLA before public launch |

## Hard release blockers

- No reusable provider credential may enter model context.
- Production OAuth scopes must be the narrowest scopes required by the selected feature.
- Native installers must be signed; macOS distribution must be notarized.
- The exact candidate must complete the 72-hour soak; historical runs cannot be relabeled.
- Independent security review and independent scientific reproduction are required before claiming production assurance.
- Incident response needs a named accountable owner, escalation route, notification decision rule and tested rollback.
- Browser early access and native release-candidate labels remain until the corresponding evidence is complete.

## Evidence hygiene

Every completed attestation must include:

- exact source commit;
- issue time, scope and limitations;
- HTTPS evidence URL;
- artifact names, SHA256 digests and expiry dates where artifacts are required;
- validation fields required by the domain;
- named independent reviewer and organization for independent-review domains.

The repository gate checks structure and source identity. An accountable release reviewer must still verify artifact authenticity, provider ownership, signing identity, legal adequacy and reviewer independence.
