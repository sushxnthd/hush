# Hush production attestations

`npm run prod:gate` does not permit release claims from code presence alone. Each JSON file in this directory represents evidence that must come from the corresponding real-world validation step.

## Attestation format (v2)

```json
{
  "schema": "hush.release-evidence.v2",
  "status": "pending",
  "issuedAt": null,
  "commit": null,
  "scope": "Exact validation scope and candidate artifacts",
  "limitations": "What this evidence does not establish",
  "evidence": "Replace only after the validation has completed",
  "evidenceUrls": [],
  "artifacts": [],
  "reviewer": null
}
```

Do not create `status: pass` attestations merely to satisfy the gate. They must point to completed evidence.

Completed v2 evidence needs a valid issue time, full source commit, explicit scope and limitations, and checkable HTTPS evidence URLs. Artifact-based domains additionally require named artifacts, SHA256 digests, evidence URLs and unexpired retained artifacts. Independent review/reproduction needs a named reviewer, organization and explicit independence. Use completed evidence to fill these fields; the pending template intentionally fails.

The gate compares the attested source against the candidate's protected runtime files, including dirty and untracked files. Changed runtime source invalidates old runtime attestations. Unrelated documentation changes can preserve scoped source evidence. Missing Git history blocks validation; the gate's workflow fetches the full history.

The `validation` object must contain actual domain results where required. A durability attestation embeds its `hush.durability-soak.v2` report with matching commit, at least 259,200,000 ms active and wall time, 20 crashes and complete coverage. Signing evidence names Windows/macOS signed platforms and verified macOS notarization/signatures. Keystore evidence records `windows-dpapi`, `macos-keychain`, `linux-secret-service` and no plaintext fallback. Provider registration records production registration, least privilege and revocation. Accessibility records keyboard, screen reader, focus, contrast, zoom, first run, storage failure and recovery results. Incident evidence identifies the accountable owner and completed incident/rollback exercises.

Historical v1 evidence remains in this directory for traceability but does not pass the v2 candidate gate. Do not upgrade its schema without rechecking scope, source identity and retained results. The gate checks local structure/source identity; an accountable reviewer must verify external evidence authenticity. A JSON file alone cannot establish a reviewer's independence, provider approval, signing identity or staffed incident response.

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
