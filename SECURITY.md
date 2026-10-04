# Security
This is an alpha research implementation, not a certified password manager or payment control. Do not store production secrets yet.

Implemented: AES-256-GCM local vault, Ed25519 Grants, scope/expiry/use limits, exact-action one-use approvals, structured secret redaction, and hash-chained receipts.

Not solved yet: hostile local malware, arbitrary GUI agents that bypass Supakeep, perfect semantic secret detection, side-channel leakage, hardware-backed keys, and third-party security audit.
