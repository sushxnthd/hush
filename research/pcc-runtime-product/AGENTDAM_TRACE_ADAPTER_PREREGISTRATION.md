# Pinned AgentDAM trace overlay — synthetic integration preregistration

## Purpose

Test whether a dependency-free overlay can bind the released AgentDAM runner to
Hush's fail-closed boundary schema without opening benchmark tasks or calling a
paid model. This is capability-building, not confirmation.

## Pinned integration contract

- upstream revision: `5d4068a404b624ed24ebbe5fb49ba5f644557912`;
- runner blob: `099b25a89af58401692aa6d46bfd3e61f63c5cb9`;
- PromptAgent blob: `3341c4f368080e9b5991234362162151b63509c7`;
- OpenAI provider blob: `ca4cc6ccce01517b6cb1c60483b7848118bfc8e8`.

The overlay must refuse a changed revision/blob or missing integration anchor.

## Frozen prediction

Across six synthetic cases and raw/PCC arms:

1. all 12 expected traces remain valid and in the denominator;
2. raw prompts disclose the protected canary in 6/6 cases;
3. PCC prompts disclose it in 0/6 cases;
4. both arms retain 6/6 synthetic task successes;
5. a forced first-attempt timeout in case 5 produces two model-request records,
   one retry record and a retained error in both arms;
6. every finalized trace has a 64-hex digest; and
7. all nine machine gates pass on the first run and an independent repeat is
   byte-identical.

No benchmark data path may be read by the adapter dry run.

## Limits

The browser page and model module are synthetic doubles. Network-request capture
is exercised through the same `page.on("request", ...)` interface but not a live
Playwright session. The overlay is not yet wired into AgentDAM's CLI loop and
does not provide semantic inference scoring or faithful matched controls.
