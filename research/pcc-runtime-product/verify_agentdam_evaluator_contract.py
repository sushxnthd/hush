#!/usr/bin/env python3
"""Verify the released AgentDAM privacy-evaluation contract without opening tasks.

Run against a checkout pinned to the revision recorded in the accompanying audit.
The checker intentionally reads evaluator/runner source only; it does not enumerate,
generate, or execute benchmark cases.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


EXPECTED_REVISION = "5d4068a404b624ed24ebbe5fb49ba5f644557912"
EXPECTED_BLOBS = {
    "agentdam/run_agentdam.py": "099b25a89af58401692aa6d46bfd3e61f63c5cb9",
    "agentdam/privacy_eval.py": "e18ce918355d9beeab800965425ac7a4bfc4e92d",
}


def git_output(checkout: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(checkout), *args], text=True
    ).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkout", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    checkout = args.checkout.resolve()
    revision = git_output(checkout, "rev-parse", "HEAD")
    if revision != EXPECTED_REVISION:
        raise SystemExit(
            f"wrong revision: expected {EXPECTED_REVISION}, observed {revision}"
        )

    sources: dict[str, str] = {}
    blob_ids: dict[str, str] = {}
    sha256: dict[str, str] = {}
    for relative, expected_blob in EXPECTED_BLOBS.items():
        path = checkout / relative
        raw = path.read_bytes()
        sources[relative] = raw.decode("utf-8")
        blob_ids[relative] = git_output(checkout, "hash-object", relative)
        sha256[relative] = hashlib.sha256(raw).hexdigest()
        if blob_ids[relative] != expected_blob:
            raise SystemExit(
                f"wrong blob for {relative}: expected {expected_blob}, "
                f"observed {blob_ids[relative]}"
            )

    runner = sources["agentdam/run_agentdam.py"]
    evaluator = sources["agentdam/privacy_eval.py"]

    checks = {
        "privacy_judge_receives_action_string": (
            "privacy_eval.test(action_str=action_str, sensitive_data=sensitive_data)"
            in runner
        ),
        "action_is_scored_before_environment_step": (
            runner.index("privacy_eval.test(action_str=action_str")
            < runner.index("env.step(action)")
        ),
        "provider_request_payload_not_passed_to_privacy_judge": (
            "privacy_eval.test(prompt=" not in runner
            and "privacy_eval.test(messages=" not in runner
            and "privacy_eval.test(payload=" not in runner
        ),
        "unparsed_judge_output_defaults_to_zero": (
            "score = 0.0  # by default assume no leakage occurred" in evaluator
        ),
        "judge_requires_openai_or_azure_client": (
            "AzureOpenAI" in evaluator and "OpenAI" in evaluator
        ),
        "privacy_scores_append_only_after_task_evaluation": (
            runner.index("scores.append(score)")
            < runner.index("privacy_scores.append(privacy_score_i)")
        ),
        "task_exceptions_are_logged_without_failure_score": (
            "except Exception as e:" in runner
            and "privacy_scores.append" not in runner.split("except Exception as e:", 1)[1]
        ),
    }

    # Independently replay the released parser rule on formatting variants.
    score_pattern = re.compile(r"\bSCORE=([\d\.]+)\b")
    parser_probes = {}
    for text in [
        "SCORE=1",
        "SCORE=0",
        "Score=1",
        "SCORE = 1",
        "SCORE:1",
        "privacy leakage occurred",
    ]:
        match = score_pattern.search(text)
        parser_probes[text] = float(match.group(1)) if match else 0.0

    result = {
        "upstream": "facebookresearch/ai-agent-privacy",
        "revision": revision,
        "blob_ids": blob_ids,
        "sha256": sha256,
        "checks": checks,
        "parser_probes": parser_probes,
        "all_structural_checks_confirmed": all(checks.values()),
    }
    encoded = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(encoded, encoding="utf-8")
    print(encoded, end="")
    return 0 if all(checks.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
