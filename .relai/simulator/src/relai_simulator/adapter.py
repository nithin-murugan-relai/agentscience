from __future__ import annotations

import asyncio

from agentscience_agent import build_agent, run_agent

from relai_simulator.adapter_contract import AgentAdapter
from relai_simulator.adapter_contract import AgentTurnResult


class ProjectAgentAdapter:
    agent_or_tools: object | None = None

    def __init__(self, agent_target: str | None = None) -> None:
        if agent_target not in (None, "agentscience"):
            raise ValueError(f"Unsupported agent target: {agent_target}")
        self._agent = build_agent()

    async def run_turn(self, user_input: object) -> AgentTurnResult:
        if not isinstance(user_input, str):
            raise TypeError(
                "AgentScience simulator turns must be raw strings matching the task "
                "passed to agentscience_agent.run_agent()."
            )
        run_result = await asyncio.to_thread(run_agent, self._agent, user_input)
        assistant_message = run_result.final_text or run_result.transcript
        return AgentTurnResult(
            assistant_message=assistant_message,
            metadata={
                "num_turns": run_result.num_turns,
                "hit_unknown_subcommand": run_result.hit_unknown_subcommand,
                "agent_transcript": run_result.transcript,
            },
        )


def build_agent_adapter(agent_target: str | None = None) -> AgentAdapter:
    return ProjectAgentAdapter(agent_target=agent_target)
