# Security
This is an alpha research implementation, not a certified password manager or payment control. Do not store production secrets yet.

Implemented: AES-256-GCM local vault, Ed25519 Grants, scope/expiry/use limits, exact-action one-use approvals, structured secret redaction, and hash-chained receipts.

Not solved yet: hostile local malware, arbitrary GUI agents that bypass Hush, perfect semantic secret detection, side-channel leakage, hardware-backed keys, and third-party security audit.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/sushxnthd/hush/security/advisories/new) if it is available. If the repository has not enabled it, open a minimal public issue requesting a private security contact without exploit details, credentials or personal data. A dedicated staffed security contact and response SLA are not currently published.

Incident handling follows [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). Production launch requires an accountable owner and a completed incident exercise; this policy does not claim either has been verified.
