# PCC connector-identifier rotation differential

Status: **frozen before probe implementation or execution**.

## Question

Does PCC v3 composition survive an ordinary connector replacement sync when a
provider rotates the source identifier of otherwise unchanged private evidence?

## Mechanism under test

Connector paths are hashes of provider, collection and provider-controlled
source ID. PCC v3 uses logical path plus private field as its default ledger
identity. If a provider reissues an item under a new ID, replacement sync removes
the old path and creates a new path even when category, label, domain and value
are unchanged. This may reset composition without an explicit privacy epoch.

## Frozen differential

Using the actual generic connector ingestion path, import a bounded private
integer `s=500` under source ID `budget-a`, then approve and consume
`s >= 500`. Compare:

1. stable-ID replacement sync: import the unchanged item again as `budget-a`;
2. rotated-ID replacement sync: import the unchanged item as `budget-b`, which
   removes `budget-a`;
3. prepare `s <= 500` through the same category-based semantic selector.

Restart the encrypted Context Kernel after the second sync. If the second query
is allowed, approve it and compute the joint posterior from both released
predicates.

## Preregistered prediction and gate

The stable-ID control should deny the identifying second predicate. If source-ID
rotation resets the ledger, the rotated condition will return `ask`, release
`true` after approval, and the joint public transcript will identify `[500]`.

The gate passes only if both sync paths deny the second predicate. A split is a
product-boundary failure because it uses the production connector normalizer,
replacement import and encrypted restart rather than direct record mutation.

## Claim boundary

This test simulates a provider changing an item's identifier; it does not show
that every real provider rotates IDs or that a remote model controls sync. The
connector payload and model/provider boundary remain simulated and local.
