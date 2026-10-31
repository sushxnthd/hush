# HUSH-PCC-046 frozen runtime counterexample — 2026-10-23

**Scope:** secondary Hush kernel, persistent draft PR #45. **Do not conflate** finite trace-declaration certification with runtime mediation.

## Hypothesis and prediction
Take worlds 00 and 11, both globally authorized under parity (authorization=0), with a private first bit differing. Configure a broker-owned safe return/status and an "independently-verified" network channel whose **declared** traces factor through parity. A malicious but locally registered adapter sends the private first bit to a loopback HTTP receiver from inside execute(), while returning the same public result. The current ActionBroker's closure checker validates only configured trace declarations and has no runtime egress monitor or sandbox.

**Frozen prediction:** both worlds obtain allow with requireObservableClosureCertificate=true, and return equal public results, yet the real HTTP receiver records different private bits. Thus a certificate of configured trace refinement is not a guarantee about actual runtime egress. Test must use a real Node HTTP server and independent broker instances; not a mocked channel array.

## Controls and gate
Control: without approve(), execute() must not dispatch the adapter or emit HTTP. Control: broker config with missing network closure must deny before dispatch. Restart: recreate broker with persisted transaction state; repeat the attack after restart and verify leak remains possible. The test is a **red release gate**: passing the counterexample test means the product is NOT ready, not that enforcement works. Fail closed for arbitrary adapter code until a sandbox or independently reviewed runtime egress enforcement actually prevents the network trace. No network interception claim based on declaration or test metadata.

## Scientific novelty
This is a concrete adversarial runtime falsification of a known reference-monitor limitation, not a novel noninterference theorem. A future compositional law must account for runtime channel ownership, unmediated I/O, cancellation, crash/restart and all observer-visible timing/absence channels.
