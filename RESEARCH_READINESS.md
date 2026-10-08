# Hush production-readiness research brief

The scientific-validation track is frozen in [research/SCIENTIFIC_VALIDATION_V2.md](research/SCIENTIFIC_VALIDATION_V2.md). It extends the internal synthetic protocols with external AgentDAM/AgentLeak-style task evidence and behavioral side-channel tests; it is a preregistration, not a completed result.

Updated 9 October 2026. This brief records primary-source research that refines Hush's launch gates. It is not a certification, an independent review, or evidence that a gate has passed.

## Findings mapped to Hush

### Google provider onboarding

Hush's current provider implementation requests these Google scopes:

- Connectors: `gmail.readonly`, `calendar.readonly`, `drive.metadata.readonly`, and `contacts.readonly`.
- Actions: `gmail.send` and `calendar.events`.

Google's production guidance requires the app to use the narrowest scopes needed, configure a public homepage with terms and privacy links on a verified domain, and complete the applicable OAuth verification for public apps. Sensitive scopes require additional verification; restricted scopes can require a security assessment when restricted-scope data is stored or transmitted. The exact classification must be checked against the current Google scope catalogue during submission, not inferred from a label in code.

Implications:

1. Keep the connector/action picker explicit and request only the selected capabilities.
2. Produce a scope inventory that maps each selected scope to the exact Hush feature and endpoint.
3. Check whether any connector can use a narrower scope (for example, a per-file Drive scope) before submission.
4. Complete consent branding, verified-domain ownership, privacy/terms URLs, Google verification, and any required security assessment.
5. Treat live provider E2E as blocked until those steps and the protected test credentials are in place.

Primary sources: [Google OAuth production policies](https://developers.google.com/identity/protocols/oauth2/policies), [sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification), [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification), [Gmail scope guidance](https://developers.google.com/workspace/gmail/api/auth/scopes), [Calendar scope guidance](https://developers.google.com/workspace/calendar/api/auth), and [Drive scope guidance](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

### Google desktop OAuth

Google's native-app guidance supports loopback redirects for macOS, Linux, and Windows desktop clients, and recommends PKCE for desktop applications. Hush already uses a loopback redirect and S256 PKCE. Production evidence should still verify loopback binding, state/PKCE mismatch rejection, short-lived authorization sessions, and refresh/revocation behavior on each supported desktop OS.

Primary sources: [OAuth 2.0 for desktop apps](https://developers.google.com/identity/protocols/oauth2/native-app) and [Google authorization best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).

### GitHub authorization choice

GitHub requires device flow to be explicitly enabled before a client can use it. GitHub's current guidance also says authorization code with PKCE is preferable when the application has a web interface, and warns that device flow can make phishing-style impersonation easier because it has no redirect URI.

Implications:

- Keep device flow only where the constrained/headless desktop path justifies it.
- Evaluate an authorization-code-with-PKCE path for the browser workspace or any flow with a usable web interface.
- Document the chosen flow, requested scopes, visible origin/app identity, polling limits, expiration handling, disconnect/revocation, and anti-phishing copy.

Primary sources: [GitHub authorization](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitHub OAuth app creation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), and [GitHub OAuth best practices](https://docs.github.com/enterprise-cloud@latest/apps/oauth-apps/building-oauth-apps/best-practices-for-creating-an-oauth-app).

### Signed distribution

For software distributed outside the Mac App Store, Apple requires Developer ID signing and notarization for current macOS distribution. Windows MSI/EXE distribution requires Authenticode signing; Microsoft documents timestamped signatures as part of the signing process.

Evidence must include the protected signing identity, signed artifact checks, Apple notarization result/ticket (and stapled artifact where applicable), Windows signature and timestamp verification, final checksums, and an update/rollback exercise on clean machines.

Primary sources: [Apple Developer ID](https://developer.apple.com/developer-id/), [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution), [Microsoft Windows code-signing options](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options), and [Microsoft Authenticode timestamping](https://learn.microsoft.com/en-us/windows/win32/seccrypto/time-stamping-authenticode-signatures).

### Accessibility and first-run usability

WCAG 2.2 is the current W3C recommendation and adds criteria directly relevant to Hush's first-run and console flows: focus not obscured, target size, accessible authentication, redundant entry, and consistent help. Static semantics and automated browser checks are useful partial evidence but cannot prove screen-reader output, keyboard-only completion, zoom/reflow, touch target usability, or storage-failure recovery.

The accessibility gate should therefore retain a manual matrix covering keyboard-only, at least one screen reader per supported desktop platform, 200% zoom/reflow, mobile/touch, reduced motion, contrast, focus visibility, passphrase/authentication, and browser/native storage failure and recovery.

Primary source: [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/).

### Security assurance

OWASP ASVS 5.0.0 is the current stable web-application verification baseline. Hush should map the browser workspace, authenticated HTTP surface, onboarding, authority broker, and release/update paths to the applicable ASVS requirements. OWASP's AI/LLM verification material can be used as supplemental threat coverage, not as a substitute for an independent assessment.

The independent-assurance gate still requires a reviewer outside the implementation team to reproduce the privacy protocol and frozen research results, perform a scoped security/red-team review, record findings and remediation, and retest the exact candidate.

Primary sources: [OWASP ASVS](https://owasp.org/projects/asvs), [OWASP AISVS](https://owasp.org/projects/artificial-intelligence-security-verification-standard-aisvs-docs), and [OWASP LLMSVS](https://owasp.org/www-project-llm-verification-standard/LLMSVS-v2.0-en.html).

### Incident response and operations

NIST SP 800-61 Revision 3 (April 2025) supersedes Revision 2. The owner-led Hush drill should cover preparation/governance, detection, response, recovery, and lessons learned, with named decision-makers, private reporting, evidence preservation, rollback authority, user communication, and follow-up actions.

Primary sources: [NIST SP 800-61 Rev. 3](https://csrc.nist.gov/pubs/sp/800/61/r3/final) and [NIST incident-response project](https://csrc.nist.gov/projects/incident-response).

### Current competitor surface

Public first-party Supermemory sources currently show a console sign-in surface with Google, GitHub, AgentID, and email options, and the console changelog describes a sidebar plus Data, Developer tools, and Settings navigation. Supermemory's September 2026 product update says its company brain and Nova products were discontinued, while its memory API, MCP, plugins, and local/self-hosted materials continue.

Implications:

- Match Hush against the currently maintained Supermemory API/MCP/plugin/local surfaces, not the discontinued Nova/company-brain product.
- Keep the signed-in dashboard parity claim pending an authorized reference view.
- Use matched, same-corpus trials before claiming equivalence or superiority; public feature pages are not performance evidence.

Primary sources: [Supermemory console](https://console.supermemory.ai/wp), [console changelog](https://supermemory.ai/changelog/console/), [product update](https://supermemory.ai/blog/an-update-to-supermemory/), and [API reference](https://api.supermemory.ai/reference).

## Resulting gate changes

This research does not convert any blocked domain to a pass. It makes the completion evidence more precise:

- Provider registration now includes Google OAuth verification/scope classification and a documented GitHub flow choice.
- Signed distribution now requires platform-specific signing and verification artifacts, not only checksums.
- Accessibility now requires a manual WCAG 2.2-oriented matrix.
- Independent assurance now uses ASVS 5.0 as a scoping baseline and remains independent.
- Operations now references NIST SP 800-61r3 and requires a real owner-led drill.
- Competitive claims remain blocked until current-surface matched trials and authorized signed-in reference inspection are complete.
