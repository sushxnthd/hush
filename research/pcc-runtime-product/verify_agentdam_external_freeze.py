#!/usr/bin/env python3
"""Verify an ID-only AgentDAM study freeze without reading task payload fields."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git(checkout: Path, *args: str) -> str:
    return subprocess.run(
        ["git", "-C", str(checkout), *args],
        check=True,
        text=True,
        capture_output=True,
    ).stdout.strip()


def selected_ids(revision: str, domain: str, task_ids: list[int], count: int) -> list[int]:
    return sorted(
        task_ids,
        key=lambda task_id: hashlib.sha256(
            f"{revision}:{domain}:{task_id}".encode("utf-8")
        ).hexdigest(),
    )[:count]


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def command_works(command: list[str]) -> bool:
    try:
        return subprocess.run(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=10,
            check=False,
        ).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkout", type=Path)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).with_name("agentdam_external_freeze_manifest.json"),
    )
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    revision = manifest["upstream"]["revision"]
    gates: dict[str, bool] = {}
    gates["revision_matches"] = git(args.checkout, "rev-parse", "HEAD") == revision

    source_entries = [
        manifest["upstream"]["readme"],
        manifest["upstream"]["license"],
        *manifest["supporting_sources"],
    ]
    for entry in source_entries:
        path = args.checkout / entry["path"]
        key = entry["path"].replace("/", "_").replace(".", "_")
        gates[f"{key}_sha256"] = sha256(path) == entry["sha256"]
        gates[f"{key}_git_blob"] = git(args.checkout, "hash-object", entry["path"]) == entry["git_blob"]
        if "bytes" in entry:
            gates[f"{key}_bytes"] = path.stat().st_size == entry["bytes"]

    selection: dict[str, list[int]] = {}
    for dataset in manifest["datasets"]:
        path = args.checkout / dataset["path"]
        key = dataset["domain"]
        gates[f"{key}_sha256"] = sha256(path) == dataset["sha256"]
        gates[f"{key}_git_blob"] = git(args.checkout, "hash-object", dataset["path"]) == dataset["git_blob"]
        gates[f"{key}_bytes"] = path.stat().st_size == dataset["bytes"]

        # Deliberately extract only task_id. No task prompt, sensitive_data,
        # outcome, website state, or action field enters the verification result.
        records = json.loads(path.read_text(encoding="utf-8"))
        task_ids = [record["task_id"] for record in records]
        gates[f"{key}_integer_ids"] = all(type(task_id) is int for task_id in task_ids)
        gates[f"{key}_unique_ids"] = len(task_ids) == len(set(task_ids))
        gates[f"{key}_source_count"] = len(task_ids) == dataset["source_case_count"]
        chosen = selected_ids(
            revision,
            key,
            task_ids,
            manifest["selection"]["cases_per_domain"],
        )
        selection[key] = chosen
        gates[f"{key}_selection"] = chosen == dataset["selected_task_ids"]

    provenance_pass = all(gates.values())
    python_supported = sys.version_info[:2] in {(3, 10), (3, 11)}
    readiness = {
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "python_supported": python_supported,
        "docker_cli": shutil.which("docker") is not None,
        "docker_daemon": command_works(["docker", "info"]),
        "gpu_visible": command_works(["nvidia-smi", "-L"]),
        "playwright_cli": shutil.which("playwright") is not None,
        "python_modules": {
            name: module_available(name)
            for name in ["beartype", "openai", "playwright", "tiktoken", "torch", "vllm"]
        },
    }
    environment_ready = (
        readiness["python_supported"]
        and readiness["docker_daemon"]
        and readiness["gpu_visible"]
        and readiness["playwright_cli"]
        and all(readiness["python_modules"].values())
    )

    result = {
        "study": manifest["study"],
        "upstream_revision": revision,
        "provenance_gate": "PASS" if provenance_pass else "FAIL",
        "provenance_checks": gates,
        "selected_task_ids": selection,
        "selected_case_count": sum(map(len, selection.values())),
        "fields_inspected": ["task_id"],
        "task_outcomes": "UNOPENED",
        "environment": readiness,
        "environment_gate": "PASS" if environment_ready else "BLOCKED",
        "semantic_judge": manifest["semantic_judge"],
        "matched_controls": manifest["matched_controls"],
        "study_execution": "BLOCKED" if not environment_ready else "NOT_AUTHORIZED_BY_THIS_VERIFIER",
    }
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0 if provenance_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
