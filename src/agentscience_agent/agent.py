"""The two-function shape RELAI plugs into: build_agent (higher-order) and run_agent.

    build_agent(prompt) -> Agent            hold a candidate system prompt
    run_agent(agent, task) -> RunResult     one headless harness run, sandboxed backend

AgentScience's agent is a markdown prompt executed by a host harness (Claude Code /
Codex). run_agent reproduces that production surface headlessly: `claude -p` with the
candidate prompt appended as system prompt, the repo's `agentscience` CLI on PATH, and
auth pointed at a throwaway localhost sandbox so nothing reaches agentscience.app.

SCOPE: prompt only. build_agent takes the prompt text; nothing here edits the CLI,
the web app, or the personality compilers.
"""

from __future__ import annotations

import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .sandbox import Sandbox

REPO_ROOT = Path(__file__).resolve().parents[2]

MODEL = os.environ.get("AGENT_MODEL", "sonnet")
MAX_TURNS = int(os.environ.get("AGENT_MAX_TURNS", "12"))
TIMEOUT_S = int(os.environ.get("AGENT_TIMEOUT_S", "600"))


@dataclass
class Agent:
    prompt: str


@dataclass
class RunResult:
    final_text: str
    transcript: str
    num_turns: int
    hit_unknown_subcommand: bool


def build_agent(prompt: str | None = None) -> Agent:
    """Return an Agent handle for a candidate prompt.

    When `prompt` is None, the canonical baseline artifact
    (agentscience_agent.prompt.AGENTSCIENCE_SYSTEM_PROMPT) is used — the single source
    of truth the optimizer edits, so a default build in an optimizer worktree runs the
    optimized prompt.
    """
    if prompt is None:
        from .prompt import AGENTSCIENCE_SYSTEM_PROMPT

        prompt = AGENTSCIENCE_SYSTEM_PROMPT
    return Agent(prompt=prompt)


def run_agent(agent: Agent, task: str) -> RunResult:
    """Run one headless harness session for `task` and return the rendered transcript."""
    with Sandbox() as base_url:
        env = dict(os.environ)
        env["PATH"] = f"{REPO_ROOT / 'bin'}:{env['PATH']}"
        env["AGENTSCIENCE_BASE_URL"] = base_url
        env["AGENTSCIENCE_TOKEN"] = "agsk_relai_sandbox"
        proc = subprocess.run(
            [
                "claude", "-p", task,
                "--append-system-prompt", agent.prompt,
                "--model", MODEL,
                "--max-turns", str(MAX_TURNS),
                "--allowedTools", "Bash", "Read", "Glob", "Grep", "Write", "Edit",
                "--output-format", "stream-json", "--verbose",
            ],
            cwd=REPO_ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_S,
        )
    transcript_lines: list[str] = []
    final_text = ""
    num_turns = 0
    for line in proc.stdout.splitlines():
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            continue
        kind = msg.get("type")
        if kind == "assistant":
            for block in msg["message"].get("content", []):
                if block.get("type") == "text":
                    transcript_lines.append(f"ASSISTANT: {block['text']}")
                elif block.get("type") == "tool_use":
                    arg = block.get("input", {})
                    detail = arg.get("command", arg.get("file_path", ""))
                    transcript_lines.append(f"TOOL {block['name']}: {detail}")
        elif kind == "user":
            for block in msg["message"].get("content", []):
                if isinstance(block, dict) and block.get("type") == "tool_result":
                    content = block.get("content", "")
                    if isinstance(content, list):
                        content = " ".join(
                            b.get("text", "") for b in content if isinstance(b, dict)
                        )
                    transcript_lines.append(f"RESULT: {str(content)[:1500]}")
        elif kind == "result":
            final_text = msg.get("result", "") or final_text
            num_turns = msg.get("num_turns", num_turns)
    transcript = "\n".join(transcript_lines)
    return RunResult(
        final_text=final_text,
        transcript=transcript,
        num_turns=num_turns,
        hit_unknown_subcommand="Unknown research subcommand" in transcript,
    )
