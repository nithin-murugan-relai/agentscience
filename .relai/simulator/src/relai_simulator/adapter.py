"""RELAI simulator adapter for AgentScience.

Two turn shapes are supported.

**Plain string** - the original behaviour. The string is the task; the agent's
final text comes back as the assistant message. Existing learning environments
(`pipeline-supported-subcommands`, `cli-help-self-consistency`,
`discoverybench-state-the-finding`) all use this.

**JSON object with a `question` key** - a DiscoveryBench sample. The adapter
builds the task from the row, runs the agent, then scores the answer with
*DiscoveryBench's own evaluator* and returns the verdict as a JSON payload. The
learning environment reads the score out of that payload rather than judging the
prose itself, which is the same shape the DeepSWE harness uses to pass its
verifier reward through.

That distinction matters for the experiment: training signal and reported metric
are then the same external number, on disjoint task splits, instead of a proxy we
invented and a benchmark score that never saw each other.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from agentscience_agent import build_agent, run_agent

from relai_simulator.adapter_contract import AdapterRuntime
from relai_simulator.adapter_contract import AgentAdapter
from relai_simulator.adapter_contract import AgentTurnResult

REPO_ROOT = Path(__file__).resolve().parents[4]


def _as_discoverybench_sample(user_input: object) -> dict[str, Any] | None:
    """Return the sample dict when this turn is a DiscoveryBench row."""
    payload: Any = user_input
    if isinstance(payload, str):
        text = payload.strip()
        if not text.startswith("{"):
            return None
        try:
            payload = json.loads(text)
        except ValueError:
            return None
    if isinstance(payload, dict) and payload.get("question"):
        return payload
    return None


def _resolve_data_dir(sample: dict[str, Any]) -> Path:
    """Data lives in the repo, so it resolves inside optimizer worktrees too."""
    raw = str(sample.get("data_path") or "").strip()
    if not raw:
        return REPO_ROOT
    path = Path(raw)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path.parent if path.suffix else path


def _build_task_text(sample: dict[str, Any]) -> str:
    columns = str(sample.get("columns") or "").strip()
    column_block = ""
    if columns:
        rendered = "\n".join(
            f"  - {part.strip()}" for part in columns.split(";") if part.strip()
        )
        column_block = f"Columns:\n{rendered}\n\n"
    return (
        f"Research question: {sample['question']}\n\n"
        f"The data is in this directory:\n{_resolve_data_dir(sample)}\n\n"
        f"{column_block}"
        "Analyse the data and state what you find. Name the variables involved "
        "and the direction or form of any relationship. If the data does not "
        "support a finding, say so."
    )


class ProjectAgentAdapter:
    capabilities = frozenset({"run_turn"})
    agent_or_tools: object | None = None

    def __init__(
        self,
        agent_target: str | None = None,
        runtime: AdapterRuntime | None = None,
    ) -> None:
        if agent_target not in (None, "agentscience"):
            raise ValueError(f"Unsupported agent target: {agent_target}")
        self._agent = build_agent()
        self._runtime = runtime

    async def run_turn(
        self,
        user_input: object,
        runtime: AdapterRuntime | None = None,
    ) -> AgentTurnResult:
        sample = _as_discoverybench_sample(user_input)
        if sample is not None:
            return await self._run_discoverybench_turn(sample)

        if not isinstance(user_input, str):
            raise TypeError(
                "AgentScience simulator turns must be a raw string task, or a JSON "
                "object carrying a DiscoveryBench sample."
            )
        run_result = await asyncio.to_thread(run_agent, self._agent, user_input)
        return AgentTurnResult(
            assistant_message=run_result.final_text or run_result.transcript,
            metadata={
                "num_turns": run_result.num_turns,
                "hit_unknown_subcommand": run_result.hit_unknown_subcommand,
                "agent_transcript": run_result.transcript,
            },
        )

    async def _run_discoverybench_turn(
        self, sample: dict[str, Any]
    ) -> AgentTurnResult:
        from agentscience_agent.discoverybench import (
            metadata_from_columns,
            score_answer,
        )

        task_text = _build_task_text(sample)
        run_result = await asyncio.to_thread(run_agent, self._agent, task_text)
        answer = run_result.final_text or ""

        dataset_type = str(sample.get("dataset_type") or "synth")
        verdict = await asyncio.to_thread(
            score_answer,
            sample["question"],
            str(sample.get("expected_finding") or ""),
            answer,
            metadata_from_columns(
                str(sample.get("columns") or ""), dataset_type=dataset_type
            ),
            dataset_type,
        )

        payload = {
            "task_id": sample.get("task_id"),
            "answer": answer,
            "num_turns": run_result.num_turns,
            **verdict,
        }
        return AgentTurnResult(
            assistant_message=json.dumps(payload),
            metadata={
                "discoverybench": {
                    k: v for k, v in payload.items() if k != "answer"
                },
                "agent_transcript": run_result.transcript,
            },
        )


def build_agent_adapter(
    agent_target: str | None = None,
    runtime: AdapterRuntime | None = None,
) -> AgentAdapter:
    return ProjectAgentAdapter(agent_target=agent_target, runtime=runtime)
