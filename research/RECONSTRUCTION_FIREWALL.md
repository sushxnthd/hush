# Persistent Reconstruction Firewall

## Status

Experimental mechanism and falsification target. This document does **not** claim a universal privacy guarantee or a new theorem.

## Problem

Encrypting private context at rest prevents a storage provider or database leak from trivially exposing plaintext. It does not, by itself, stop an authorized AI from learning the same secret through a sequence of individually small answers.

A second failure mode appears if privacy accounting exists only inside one short-lived task. An adaptive caller can start a fresh task, rename the agent, change its stated purpose, or rotate destinations and continue the reconstruction attack with a fresh budget.

The firewall closes that reset loophole for Supakeep's controlled explicit output channel.

## Threat model

Assume an adaptive caller can:

- create many task trajectories;
- choose each next bounded query based on earlier answers;
- change agent identifiers and purpose strings;
- send answers to different sinks;
- collude across those identities and sinks;
- keep querying the same underlying private field.

The attacker cannot directly read the local plaintext store or bypass Supakeep's decision boundary in this model.

## Mechanism

Supakeep now has two accounting layers.

### 1. Task trajectory budget

Each task gets a short-lived runtime-minted trajectory. If a result has `N` possible explicit outputs, Supakeep conservatively charges up to:

```text
log2(N) bits
```

Repeated deterministic queries at the same profile revision are free inside that trajectory because the same answer does not add new explicit information.

### 2. Persistent field budget

The new `PersistentReconstructionFirewall` separately tracks information capacity associated with every referenced private field across trajectories.

The default alpha policy is:

```text
rolling window:         7 days
global field budget:    8 bits
per-audience budget:    6 bits
```

The global field budget does not depend on the claimed agent identity, purpose string, trajectory id, or destination. Rotating those labels therefore does not reset the field's cumulative budget.

A second per-audience budget prevents one destination from concentrating the whole global allowance.

For a decision that depends on several private fields, the current implementation conservatively charges the full explicit output capacity to every referenced field. This can over-count leakage, but it avoids pretending that the runtime can currently attribute the output's mutual information precisely among multiple secrets.

## Persistence

The reconstruction ledger is stored inside the encrypted Context Kernel state. Restarting Supakeep therefore does not reset the budget.

The persisted bundle does not contain private field names, ledger entries, labels, tags or values in plaintext. Those are encrypted using the same sealed-context data key.

## Cross-trajectory benchmark

`bench/cross-trajectory-reconstruction.js` attacks a hidden integer in `0..999999` with adaptive greater-than predicates. Every query deliberately starts a brand-new one-bit task trajectory.

Observed CI result:

| Attack | Answers released | Next query denied | Exact secret recovered | Candidates remaining |
| --- | ---: | ---: | --- | ---: |
| No persistent firewall | 20 | — | yes | 1 |
| Persistent firewall, same sink | 6 | 7 | no | 15,625 |
| Persistent firewall, rotating sinks | 8 | 9 | no | 3,906 |

This result demonstrates one specific reset attack and one specific bounded-query family. It is not proof that arbitrary private information cannot be inferred.

## Sealed context storage

`SealedContextStore` adds a separate storage property:

- a random 256-bit data-encryption key encrypts records with AES-256-GCM;
- a passphrase-derived scrypt key wraps that data key;
- each record has independent authenticated encryption and associated data;
- semantic metadata such as path, label, category and tags lives inside ciphertext;
- internal reconstruction state is also encrypted;
- exported sync bundles contain ciphertext and opaque identifiers, not readable context;
- modified ciphertext fails authentication.

This makes it possible for a future sync service to store the bundle without receiving the plaintext or passphrase.

## What this does not solve

The mechanism currently covers the explicit result channel controlled by `PrivateDecisionRuntime`. It does **not** yet bound information leaked through:

- response timing;
- crashes and error-shape differences;
- network metadata;
- external side effects;
- a compromised unlocked endpoint;
- an AI or connector that receives private data outside the Context Kernel;
- malicious code running with access to the local Supakeep process;
- information the user explicitly authorizes for exact disclosure.

It also does not establish that the default 8-bit and 6-bit budgets are optimal. Those values are alpha policy parameters and require empirical utility/privacy calibration on real workloads.

## Falsification targets

Before treating this as a production security property, test at least:

1. equivalent-query attacks that encode the same predicate in structurally different programs;
2. high-cardinality `choose` sets crafted to partition secret space efficiently;
3. multi-field queries designed to exploit conservative attribution gaps;
4. profile-update attacks that intentionally force new revisions;
5. colluding sinks over long time windows;
6. timing and failure-oracle attacks;
7. connector bypasses and direct provider uploads;
8. real task utility under tighter persistent budgets.

## Product implication

The intended user experience does not expose any of this accounting machinery. A user connects Supakeep once and uses their AI normally. The AI asks Supakeep for a bounded decision; Supakeep either returns the minimum result or refuses because the accumulated questions are becoming too informative.

The security boundary is therefore not "the model promises not to remember." It is a local runtime that controls both what can be computed over private context and how much explicit information can leave over time.
