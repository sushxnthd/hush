# Hush production attestations

`npm run prod:gate` does not permit release claims from code presence alone. Each JSON file in this directory represents evidence that must come from the corresponding real-world validation step.

## Attestation format

```json
{
  "status": "pass",
  "issuedAt": "2026-10-07T00:00:00Z",
  "evidence": "URL, report hash, CI run, reviewer identity, or other independently checkable evidence",
  "notes": "Optional scope and limitations"
}
```

Do not create `status: pass` attestations merely to satisfy the gate. They must point to completed evidence.

## Required evidence

- `privacy-reproduction.json` — reproduction of the frozen privacy result by someone other than the original evaluation process.
- `platform-keystore.json` — packaged Windows/macOS/Linux builds demonstrate the intended OS credential backend; no silent plaintext fallback in production.
- `google-oauth-production.json` — production Google OAuth client, verified redirect/homepage/privacy-policy configuration, consent tested.
- `github-app-production.json` — production GitHub app/OAuth registration with device authorization enabled and least privilege documented.
- `real-actions-e2e.json` — real provider-backed actions complete through Hush without reusable credentials entering model context.
- `reliability-soak.json` — at least 72 hours including restart/crash/recovery/fault injection with no state corruption.
- `recovery-drill.json` — recovery from a fresh machine/device using only the supported recovery flow.
- `accessibility-usability.json` — keyboard, screen-reader, focus/contrast and first-run usability audit.
- `distribution-signing.json` — shipped installers/executables are code-signed; macOS artifacts are notarized where applicable.
- `update-rollback.json` — signed update, failed update, and rollback paths exercised.
- `sbom-checksums.json` — release artifacts have published checksums and SBOM/provenance.
- `security-review.json` — independent security review/red-team report covering local API, OAuth, storage, action authority, recovery and update chain.
- `independent-reproduction.json` — independent reproduction of the scientific claim package.
- `legal-support-surface.json` — privacy policy, terms where required, security contact, support path and deletion/revocation instructions published.
- `incident-drill.json` — documented incident response and rollback exercise with an accountable owner.

The strict production score is **10/10 only when every engineering check and every required attestation passes**.
