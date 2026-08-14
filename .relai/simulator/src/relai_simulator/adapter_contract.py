from __future__ import annotations

from typing import Any, Protocol

import relai

AdapterRuntime = relai.AdapterRuntime
AgentTurnResult = relai.AgentTurnResult
ToolCallRecord = relai.ToolCallRecord
ToolResultRecord = relai.ToolResultRecord


class AgentAdapter(Protocol):
    capabilities: frozenset[str]
    agent_or_tools: object | None

    def run_turn(
        self,
        user_input: Any,
        runtime: AdapterRuntime | None = None,
    ) -> AgentTurnResult | Any:
        ...
