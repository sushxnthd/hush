# PCC clean-room replication v2 preregistration

Status: **frozen after the first-run extractor failure and before v2 execution**.

The sole mechanism change is to replace global numeric uniqueness with a
declarative, contract-bound capture pattern containing exactly one group. The
compiler still requires exactly one distinct in-bounds captured value and
fails closed otherwise. All original gates remain unchanged.

Additional stress condition: every source includes unrelated in-bounds numbers
outside the contract capture. These must neither change the release nor cause a
false ambiguity. Sources containing two distinct field-bound values must still
fail closed.

The first failed run remains part of the evidence and is not overwritten.

