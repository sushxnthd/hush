# PCC runtime scheduling product-translation preregistration

Status: **frozen before benchmark execution**.

## Question

Does the PCC mechanism preserve a useful scheduling action through Hush's real
runtime and Google Calendar action adapter while disclosing less exact private
context at the model boundary than raw context or exact semantic minimization?

This is a production-faithful deterministic benchmark with a simulated Google
HTTP endpoint. It is not a live-provider, external-user, or fresh scientific
holdout result.

## End-to-end path

Each case uses:

1. a fresh encrypted `ContextKernel`;
2. structured local context containing an integer availability cutoff and an
   unrelated sensitive canary;
3. two public candidate meeting times, exactly one of which is acceptable;
4. registered comparison contracts, local release approval, one-shot
   consumption, and model-visible bounded booleans;
5. `ProviderOnboarding`, its real approval-bound `ActionBroker`, and the real
   Google Calendar action adapter;
6. a captured simulated Google HTTP request and Hush action receipt.

## Arms

- **Raw:** the model boundary receives the full local record.
- **Semantic exact:** the model receives only the task-relevant cutoff, which
  is the strongest utility-preserving minimization control but still discloses
  that exact private value.
- **Strict redaction:** the actual Hush strict sanitizer is applied to the local
  record.
- **PCC:** the actual ContextKernel releases only two candidate-eligibility
  booleans after local approval.

Every successful arm uses the identical approval-bound calendar adapter. The
provider-visible event time is counted separately from model-visible context.

## Frozen cases and predictions

Run 256 cases. Cutoffs span minutes `120..375`. The public candidates are 15
minutes below and above the cutoff, so exactly one is acceptable. Every record
contains a unique protected canary.

All gates must pass:

1. raw, semantic-exact, and PCC task/action success are each 256/256;
2. strict-redaction task success is below 50%;
3. raw exposes both exact protected fields in every case;
4. semantic-exact exposes the exact cutoff but no canary in every case;
5. PCC exposes neither exact cutoff nor canary at the model boundary;
6. no PCC preparation metadata or receipt contains the cutoff or canary;
7. the provider receives only the selected public event fields, not the source,
   canary, or cutoff field;
8. every action is explicitly approved, executes once, and produces a valid
   safe receipt;
9. a second deterministic run yields byte-identical discrete outcomes.

Latency and approval counts are descriptive, not pass gates.

## Claim boundary

A pass would support only that this deterministic scheduling class can be
completed through Hush's actual bounded-compute and action-broker path without
sending the exact source fields to the model boundary. It would not establish
semantic privacy, arbitrary scheduling ability, live-provider reliability,
human usability, third-party reproduction, or superiority over a named product.

