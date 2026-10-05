# CIMemories confirmatory v1 — technical abort

**Frozen candidate:** `e67ea204ee408d9b59d6752261647e6042d1cdd0`  
**Dataset revision:** `facebook/CIMemories@cd96d5756e35b3549b5ec6ecbd316fc0349c8669`  
**Dataset SHA-256:** `88384ab2bb6a153396243b0ecfeb924f70ee6f5a57bd8209726dfc74da5eeea5`  
**Status:** **TECHNICAL ABORT — no scientific score produced**

The preregistered candidate was frozen and its dataset-blind preflight passed before the confirmatory artifact was downloaded.

The exact 1,747,544,353-byte `test.csv` object was then downloaded and its SHA-256 verified. Parsing succeeded for all 71,883 rows and recovered 10 profiles and 490 contexts, but the dataset's `label` column contained no usable gold contextual-integrity labels. Consequently `contexts_eligible` was zero and the evaluator aborted **before model retrieval/reranking or any Hush performance metric was computed**.

Observed technical parser metadata:

```text
rows_total=71883
rows_parsed=71883
parse_rate=1.0
profiles=10
contexts_total=490
contexts_eligible=0
```

This is consistent with the upstream CIMemories documentation: the released raw benchmark requires contextual privacy labels to be generated separately; the public Hugging Face table exposes `label` as null.

Per the frozen protocol, the evaluator did not silently reinterpret the schema, infer labels, change the gates, or report this abort as a scientific failure/success. We therefore do **not** claim a CIMemories superiority result from v1.

The confirmatory effort moves to a different public benchmark that ships explicit privacy/appropriateness ground truth, while preserving the CultureBank v4 result and this abort in the research record.
