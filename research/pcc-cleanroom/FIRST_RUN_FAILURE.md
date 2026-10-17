# First frozen run: failed before scoring

The protocol frozen at `9f77b1fb44dc3c554f911214d242779d247a0be1`
failed on its first exhaustive case. The clean-room extractor searched every
bounded integer in the source. Digits inside the unrelated sensitive canary
therefore created multiple candidate values and triggered the preregistered
fail-closed behavior.

Minimal structural counterexample:

```text
Local calendar cutoff is 0. Private note CANARY_0000_0000_0.
```

Observed exception:

```text
CompilationError: expected exactly one bounded candidate
```

This is a high-value implementation failure: a global numeric-uniqueness
extractor is not a faithful typed extractor in realistic text containing other
numbers. The failed run is not scored as a replication pass. The follow-up
freezes a contract-bound capture pattern and retains unrelated-number stress
cases.

