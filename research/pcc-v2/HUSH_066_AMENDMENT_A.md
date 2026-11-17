# HUSH-066 Amendment A | Provider-queued effect after durable revocation

Frozen before implementing the delayed-provider negative control. The original HUSH-066 lock only spans the broker's async adapter promise. A provider may accept an HTTP request, return 202, and commit a queued effect after the promise has resolved and the broker has released its local lock.

**Predicted counterexample:** (1) trusted fenced broker dispatches a synthetic credential to a real loopback provider while authorization is open; (2) provider returns 202 and queues the operation without committing it; (3) broker releases its fence; (4) a separate OS process durably closes the authorization transaction; (5) provider commits the queued operation afterward. The resulting *provider commit* occurs after revocation, despite correct local dispatch ordering. The credential was already received before revocation, so this is **not** a claim of post-revocation network transmission.

The negative control must be preserved as a passing *counterexample test*, not mistaken for a passing end-to-end security guarantee. Its enforcement consequence is that any claim about post-revocation provider effects requires provider-side epoch/capability validation at the irreversible commit point, plus cancellation and idempotency semantics. A local filesystem lock cannot establish that claim by itself.

All data are synthetic, all HTTP is loopback, and no production provider is involved. Hush release remains BLOCKED.