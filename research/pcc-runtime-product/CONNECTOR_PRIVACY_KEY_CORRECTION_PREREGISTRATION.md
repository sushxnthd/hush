# PCC durable connector privacy identity — correction preregistration

Status: **frozen before correction implementation or execution**.

## Hypothesis

An adapter-supplied, value-independent durable `privacyKey` can preserve PCC
composition across provider source-ID rotation without reintroducing the
private-value authorization oracle.

## Proposed mechanism

- Connector envelopes may carry a trusted `privacyKey` distinct from the
  provider's source ID.
- For bounded comparison releases over connector-backed records, PCC identity
  uses provider, collection, `privacyKey`, and private field.
- Connector-backed comparison releases without a durable key fail closed.
- Duplicate durable keys within one snapshot fail closed as ambiguous.
- Ordinary non-connector records retain logical-path/field identity.
- The key is never derived from current private value or exposed through public
  PCC diagnostics.

## Frozen differential

For secret `s=500` in domain `0..1023`:

1. ingest source ID `budget-a` with `privacyKey=travel-budget`;
2. release `s >= 500`;
3. replace it with source ID `budget-b`, preserving the privacy key and all
   other fields;
4. restart and prepare `s <= 500`;
5. separately test a connector record with no privacy key and a snapshot with
   two source IDs sharing one privacy key.

## Preregistered predictions and gates

The correction passes only if:

1. rotated source ID plus stable privacy key denies the identifying second
   predicate;
2. the stable-ID control also denies it;
3. a connector-backed bounded comparison without `privacyKey` fails closed
   before any release;
4. duplicate privacy keys in one snapshot are rejected;
5. the frozen non-connector record-recreation probe still passes;
6. focused and complete repository tests pass.

## Claim boundary

This tests trusted adapter metadata, not automatic semantic identity discovery.
A malicious or mistaken adapter can still change a key or incorrectly reuse
one. The correction must not claim protection when identity continuity is
unavailable, nor infer continuity by comparing private values.
