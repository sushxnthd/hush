#!/usr/bin/env python3
"""Fail-closed trace overlay for the pinned AgentDAM runner.

The adapter is dependency-free and does not import AgentDAM. It wraps the
module-global ``call_llm`` used by PromptAgent and accepts browser/provider
events from the runner. All records stay local and are written only on explicit
finalization.
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import subprocess
from pathlib import Path
from typing import Any, Iterator


EXPECTED_REVISION = "5d4068a404b624ed24ebbe5fb49ba5f644557912"
EXPECTED_BLOBS = {
    "agentdam/run_agentdam.py": "099b25a89af58401692aa6d46bfd3e61f63c5cb9",
    "visualwebarena/agent/agent.py": "3341c4f368080e9b5991234362162151b63509c7",
    "visualwebarena/llms/providers/openai_utils.py": "ca4cc6ccce01517b6cb1c60483b7848118bfc8e8",
}
BOUNDARIES = (
    "model_request",
    "tool_request",
    "browser_action",
    "provider_request",
    "receipt",
    "error",
    "retry",
)


def _git(checkout: Path, *args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(checkout), *args], text=True
    ).strip()


def verify_checkout(checkout: Path) -> dict[str, Any]:
    checkout = checkout.resolve()
    revision = _git(checkout, "rev-parse", "HEAD")
    if revision != EXPECTED_REVISION:
        raise ValueError(f"expected AgentDAM {EXPECTED_REVISION}, observed {revision}")
    blobs: dict[str, str] = {}
    for relative, expected in EXPECTED_BLOBS.items():
        blob = _git(checkout, "hash-object", relative)
        if blob != expected:
            raise ValueError(f"unexpected blob for {relative}: {blob}")
        blobs[relative] = blob
    agent_source = (checkout / "visualwebarena/agent/agent.py").read_text()
    runner_source = (checkout / "agentdam/run_agentdam.py").read_text()
    if "response = call_llm(lm_config, prompt)" not in agent_source:
        raise ValueError("PromptAgent call_llm integration anchor changed")
    if "action_str = get_action_description(" not in runner_source:
        raise ValueError("runner action integration anchor changed")
    if "score = evaluator(" not in runner_source:
        raise ValueError("runner receipt integration anchor changed")
    return {"revision": revision, "blobs": blobs}


def _safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, bytes):
        return {"encoding": "hex", "value": value.hex()}
    if isinstance(value, (list, tuple)):
        return [_safe(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _safe(item) for key, item in value.items()}
    return {"type": type(value).__name__, "repr": repr(value)}


class BoundaryTrace:
    def __init__(self, case_id: str, arm: str):
        self.case_id = str(case_id)
        self.arm = str(arm)
        self.boundaries: dict[str, list[dict[str, Any]]] = {
            name: [] for name in BOUNDARIES
        }
        self._model_calls = 0
        self._finalized = False

    def add(self, boundary: str, payload: Any) -> None:
        if self._finalized:
            raise RuntimeError("trace already finalized")
        if boundary not in self.boundaries:
            raise ValueError(f"unknown boundary: {boundary}")
        self.boundaries[boundary].append({"payload": _safe(payload)})

    @contextlib.contextmanager
    def patch_agent_module(self, agent_module: Any) -> Iterator[None]:
        """Patch PromptAgent's module-global call_llm symbol for one case."""
        original = agent_module.call_llm

        def traced_call_llm(lm_config: Any, prompt: Any) -> Any:
            if self._model_calls:
                self.add("retry", {"kind": "model_call", "attempt": self._model_calls + 1})
            self._model_calls += 1
            self.add(
                "model_request",
                {"attempt": self._model_calls, "config": _safe(lm_config), "prompt": _safe(prompt)},
            )
            try:
                return original(lm_config, prompt)
            except Exception as exc:
                self.add(
                    "error",
                    {"stage": "model_call", "type": type(exc).__name__, "message": str(exc)},
                )
                raise

        agent_module.call_llm = traced_call_llm
        try:
            yield
        finally:
            agent_module.call_llm = original

    def record_action(self, action_str: str, action: Any) -> None:
        payload = {"description": action_str, "action": _safe(action)}
        self.add("tool_request", payload)
        self.add("browser_action", payload)

    def attach_page(self, page: Any) -> None:
        """Capture subsequent Playwright-style requests from ``page.on``."""

        def capture(request: Any) -> None:
            method = getattr(request, "method", None)
            url = getattr(request, "url", None)
            post_data = getattr(request, "post_data", None)
            self.add(
                "provider_request",
                {"method": method, "url": url, "postData": post_data},
            )

        page.on("request", capture)

    @contextlib.contextmanager
    def patch_runner_module(self, runner_module: Any, agent_module: Any) -> Iterator[None]:
        """Attach this one-case trace to AgentDAM's released runner symbols.

        The runner source is left unchanged. Constructor, action-description and
        evaluator symbols are wrapped for the lifetime of one case and restored
        even when the runner raises.
        """
        original_env = runner_module.ScriptBrowserEnv
        original_describe = runner_module.get_action_description
        original_router = runner_module.evaluator_router

        def traced_env(*args: Any, **kwargs: Any) -> Any:
            env = original_env(*args, **kwargs)
            self.attach_page(env.page)
            for method_name in ("reset", "step"):
                original_method = getattr(env, method_name)

                def traced_method(*method_args: Any, _method=original_method, _name=method_name, **method_kwargs: Any) -> Any:
                    try:
                        return _method(*method_args, **method_kwargs)
                    except Exception as exc:
                        self.error(f"environment.{_name}", exc)
                        raise

                setattr(env, method_name, traced_method)
            return env

        def traced_describe(action: Any, *args: Any, **kwargs: Any) -> str:
            try:
                description = original_describe(action, *args, **kwargs)
            except Exception as exc:
                self.error("action_description", exc)
                raise
            self.record_action(description, action)
            return description

        def traced_router(*args: Any, **kwargs: Any) -> Any:
            evaluator = original_router(*args, **kwargs)

            def traced_evaluator(*eval_args: Any, **eval_kwargs: Any) -> Any:
                try:
                    score = evaluator(*eval_args, **eval_kwargs)
                except Exception as exc:
                    self.error("evaluator", exc)
                    raise
                self.receipt({"taskScore": _safe(score)})
                return score

            return traced_evaluator

        runner_module.ScriptBrowserEnv = traced_env
        runner_module.get_action_description = traced_describe
        runner_module.evaluator_router = traced_router
        try:
            with self.patch_agent_module(agent_module):
                yield
        finally:
            runner_module.ScriptBrowserEnv = original_env
            runner_module.get_action_description = original_describe
            runner_module.evaluator_router = original_router

    def receipt(self, payload: Any) -> None:
        self.add("receipt", payload)

    def error(self, stage: str, exc: BaseException) -> None:
        self.add(
            "error",
            {"stage": stage, "type": type(exc).__name__, "message": str(exc)},
        )

    def finalize(self, *, status: str, task_success: bool) -> dict[str, Any]:
        if self._finalized:
            raise RuntimeError("trace already finalized")
        if status not in {"completed", "failed", "refused"}:
            raise ValueError("invalid status")
        if (status == "completed") is not bool(task_success):
            raise ValueError("status/task_success mismatch")
        self._finalized = True
        body = {
            "caseId": self.case_id,
            "arm": self.arm,
            "status": status,
            "taskSuccess": bool(task_success),
            "boundaries": self.boundaries,
        }
        body["traceSha256"] = hashlib.sha256(
            json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        return body
