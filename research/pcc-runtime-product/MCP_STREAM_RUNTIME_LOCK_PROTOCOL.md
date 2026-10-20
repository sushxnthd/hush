# MCP stream runtime-lock closure: follow-up protocol

The frozen storage-primitive probe found a 100/100 lost-update counterexample.
Source inspection after that result revealed that the production server calls
`acquireRuntimeLock(dataDir)` before creating `Store`.

## Question

Does that existing deployment mechanism actually exclude a second live process
and admit a new owner after SIGKILL, using real OS processes rather than the
existing in-process unit test?

## Prediction

Across 50 fresh state directories: (1) a second process is rejected with
`HUSH_ALREADY_RUNNING` while the holder is alive; (2) after SIGKILL leaves the
lock file behind, a third process proves the PID dead, replaces the stale lease,
and acquires successfully.

## Failure gate

Fail if any live contender acquires, any dead-owner recovery is rejected, or
source order constructs `Store` before acquiring the runtime lock.

## Consequence

Passing closes the concrete counterexample for the production startup path and
makes the single-writer assumption an enforced deployment invariant. It does
not make `Store.addReceipt` multi-process safe.
