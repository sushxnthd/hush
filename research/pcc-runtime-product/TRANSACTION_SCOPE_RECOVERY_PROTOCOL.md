# Frozen protocol: transaction-scope crash recovery

## Active kernel

- **Precise question.** Can Hush preserve transaction-wide authorization across
  process death without making raw authorization maps public or reopening a
  closed transaction?
- **Best-known frontier.** The production broker enforces the exact finite-fiber
  certificate before credentials and dispatch, but all transaction state is an
  in-memory `Map` and therefore disappears on restart.
- **Exact objective.** Atomically persist an encrypted, commitment-checked
  transaction snapshot on registration and closure; after a fresh-process
  restart, safe identity scopes must retain utility, parity scopes must still
  deny before dispatch, and closed transactions must remain closed.
- **Strongest alternative explanation.** Persistence merely restores data while
  weakening fail-closed behavior: a wrong key, modified ciphertext, stale
  commitment, or interrupted write could silently create an authorization state.
- **Cheapest decisive falsification.** Any restarted parity call dispatches, any
  restarted identity call fails, any closed transaction reopens, raw maps appear
  outside encrypted storage, or corrupted/wrong-key state is accepted.
- **Mechanism-derived unseen prediction.** Because the transaction commitment is
  recomputed on load and closure is part of the encrypted snapshot, restart is
  behaviorally transparent for open identity/parity transactions but monotone
  for closure: an observed closed state cannot become open.
- **Publishable threshold.** Real fresh-process kill/restart test, all three scope
  behaviors, corruption and wrong-key adversaries, independent checker, exact
  reproducibility, focused/full regression, CI, and explicit single-host limit.
- **Project-consequence threshold.** Remove crash/restart as a blocker for the
  registered finite transaction mode on Hush's single-writer local runtime.
- **Kill condition.** The mechanism needs plaintext scope persistence, allows a
  state rollback or commitment mismatch, changes unscoped behavior, or cannot
  survive a fresh-process restart after a successful synchronous mutation.

## Frozen cases

| Case | Required post-restart result |
|---|---|
| Open identity transaction | both coordinate actions allow |
| Open parity transaction | coordinate action denies; zero dispatches |
| Closed identity transaction | request rejected as closed |
| Modified ciphertext | broker construction fails closed |
| Wrong encryption key | broker construction fails closed |
| Ordinary unscoped action | unchanged allow behavior |

The claim is durable authorization-state recovery, not exactly-once external
side effects, distributed consensus, rollback resistance against filesystem
replacement, or validation of adapter declarations.
