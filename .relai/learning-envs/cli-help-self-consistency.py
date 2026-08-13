"""RELAI learning environment: the CLI's own help must not advertise commands it cannot run.

Why this environment exists
---------------------------
`agentscience research --help` correctly lists only the implemented research
subcommands, but the *top-level* help still shows an
`agentscience research run ...` example. An agent that trusts the CLI's own
documentation therefore drifts onto a dead subcommand and fails.

This is deliberately not fixable from the prompt. The agent is required to read
the top-level help, so "just don't read help" scores zero. The only way to make
`help-advertises-only-implemented-subcommands` pass is to change the CLI's help
text so it stops advertising unimplemented subcommands.

That also makes the signal deterministic rather than sampling-dependent: given
the current repo state the evaluator fails on every rollout, so a single-rollout
anchor is still informative.
"""

from __future__ import annotations

import re
from typing import Any

from relai import (
    CodeEvaluator,
    EvaluationResult,
    FixedInput,
    FixedTurn,
    RELAIEnvironment,
    SimulationResult,
)


TAGS = [
    "end-to-end",
    "cli-self-documentation",
]

TASK = (
    "You have not used the agentscience CLI before. Start by reading its "
    "top-level help to learn what the tool can do, then report which "
    "`agentscience research` subcommands are actually available. After that, "
    "build (do not publish) a paper bundle for the idea 'Does city latitude "
    "predict the seasonal amplitude of daily temperature?' in workspace "
    "./research-runs/relai-help-1, using only research subcommands that the "
    "CLI actually implements."
)

IMPLEMENTED_RESEARCH_SUBCOMMANDS = (
    "init",
    "list",
    "literature",
    "compile",
    "check-figures",
    "template",
)
UNIMPLEMENTED_RESEARCH_SUBCOMMANDS = ("build", "run")

TOOL_LINE_RE = re.compile(r"^TOOL\s+([^:]+):\s*(.*)$")
TOP_LEVEL_HELP_RE = re.compile(
    r"\bagentscience\s+(--help|-h|help)\b|\bagentscience\s*$",
    re.MULTILINE,
)
RESEARCH_HELP_RE = re.compile(r"\bagentscience\s+research\s+(--help|-h)\b")
# Matches a help/usage line that advertises an unimplemented research subcommand.
ADVERTISED_UNIMPLEMENTED_RE = re.compile(
    r"agentscience\s+research\s+(build|run)\b"
)
HELP_OUTPUT_MARKERS = (
    "Usage:",
    "Subcommands:",
    "Examples:",
)
# Literal text that only ever appears inside the CLI's own help example for the
# unimplemented `research run` subcommand. Used as a formatting-independent
# fallback so the check still fires if transcript block parsing degrades.
HELP_EXAMPLE_FINGERPRINTS = (
    "Adaptive sampling for outbreak triage",
)


def _to_plain_data(value: Any, depth: int = 0) -> Any:
    if depth > 6:
        return repr(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, dict):
        return {
            str(key): _to_plain_data(item, depth + 1) for key, item in value.items()
        }
    if isinstance(value, (list, tuple, set)):
        return [_to_plain_data(item, depth + 1) for item in value]
    for attribute in ("model_dump", "dict", "to_dict"):
        method = getattr(value, attribute, None)
        if callable(method):
            try:
                if attribute == "model_dump":
                    return _to_plain_data(method(mode="python"), depth + 1)
                return _to_plain_data(method(), depth + 1)
            except Exception:  # pragma: no cover - defensive
                continue
    if hasattr(value, "__dict__"):
        try:
            return _to_plain_data(vars(value), depth + 1)
        except Exception:  # pragma: no cover - defensive
            pass
    return repr(value)


def _collect_strings(value: Any, sink: list[str]) -> None:
    if isinstance(value, str):
        sink.append(value)
        return
    if isinstance(value, dict):
        for item in value.values():
            _collect_strings(item, sink)
        return
    if isinstance(value, (list, tuple, set)):
        for item in value:
            _collect_strings(item, sink)


def _extract_transcript(simulation_result: SimulationResult) -> tuple[str, str]:
    data = _to_plain_data(simulation_result)
    strings: list[str] = []
    _collect_strings(data, strings)

    transcript_candidates = [
        text
        for text in strings
        if "TOOL " in text and ("RESULT:" in text or "ASSISTANT:" in text)
    ]
    transcript = max(transcript_candidates, key=len, default="")
    blob = "\n".join(strings)
    if not transcript and "TOOL " in blob and "RESULT:" in blob:
        transcript = blob
    return transcript, blob


def _parse_tool_records(transcript: str) -> list[dict[str, Any]]:
    """Split a transcript into tool calls with their full multi-line output.

    Only the first line of a tool's output carries the ``RESULT:`` prefix; the
    rest is emitted raw. So a block runs from a ``TOOL`` line until the next
    ``TOOL`` or ``ASSISTANT`` line, and everything in between is the output.
    """
    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    buffer: list[str] = []

    def flush() -> None:
        if current is not None:
            current["output"] = "\n".join(buffer).strip()
            records.append(current)

    for raw_line in transcript.splitlines():
        stripped = raw_line.strip()
        tool_match = TOOL_LINE_RE.match(stripped)
        if tool_match:
            flush()
            current = {
                "name": tool_match.group(1).strip(),
                "detail": tool_match.group(2).strip(),
                "output": "",
            }
            buffer = []
            continue
        if stripped.startswith("ASSISTANT:"):
            flush()
            current = None
            buffer = []
            continue
        if current is None:
            continue
        if stripped.startswith("RESULT:"):
            buffer.append(stripped.removeprefix("RESULT:").strip())
        else:
            buffer.append(raw_line)

    flush()
    return records


def _joined_results(record: dict[str, Any]) -> str:
    return record.get("output", "")


def _help_invocations(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tool calls that asked the CLI to print help."""
    found = []
    for record in records:
        detail = record.get("detail", "")
        if TOP_LEVEL_HELP_RE.search(detail) or RESEARCH_HELP_RE.search(detail):
            found.append(record)
    return found


def _evaluate_top_level_help_consulted(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, _ = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to verify that the "
                "agent read the CLI's top-level help."
            ),
        )

    records = _parse_tool_records(transcript)
    for index, record in enumerate(records, start=1):
        if TOP_LEVEL_HELP_RE.search(record.get("detail", "")):
            return EvaluationResult(
                score=1.0,
                feedback=(
                    f"The agent read the CLI's top-level help at tool call {index}, "
                    "which is what this task asks for."
                ),
            )

    return EvaluationResult(
        score=0.0,
        feedback=(
            "The task requires discovering the tool through its own top-level "
            "help (`agentscience --help`). No such call appears in the "
            "transcript. Skipping help is not an acceptable way to avoid bad "
            "help output."
        ),
    )


def _evaluate_help_advertises_only_implemented(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, blob = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to inspect the CLI's "
                "help output."
            ),
        )

    records = _parse_tool_records(transcript)
    help_records = _help_invocations(records)
    if not help_records:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "No CLI help output was captured, so its self-consistency could "
                "not be verified. Read `agentscience --help` first."
            ),
        )

    offenders: list[str] = []
    for record in help_records:
        output = _joined_results(record)
        if not any(marker in output for marker in HELP_OUTPUT_MARKERS):
            continue
        for match in ADVERTISED_UNIMPLEMENTED_RE.finditer(output):
            offenders.append(match.group(0))

    # Formatting-independent fallback: these strings exist only in the CLI's own
    # help example for the unimplemented subcommand.
    if not offenders:
        for fingerprint in HELP_EXAMPLE_FINGERPRINTS:
            if fingerprint in blob:
                offenders.append("agentscience research run")
                break

    if offenders:
        unique = sorted(set(offenders))
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The CLI's own help output advertises research subcommands that "
                "its dispatcher rejects with `Unknown research subcommand`: "
                + ", ".join(f"`{item}`" for item in unique)
                + ". An agent that trusts this documentation is led straight "
                "into a dead command, so the help text itself is the defect. "
                "The implemented research subcommands are: "
                + ", ".join(f"`{name}`" for name in IMPLEMENTED_RESEARCH_SUBCOMMANDS)
                + ". Fix the CLI's help so it only advertises subcommands the "
                "dispatcher implements. This cannot be fixed by changing the "
                "agent prompt."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback=(
            "Every research subcommand shown in the CLI's help output is "
            "actually implemented by the dispatcher."
        ),
    )


def _evaluate_no_unknown_subcommand(
    simulation_result: SimulationResult,
) -> EvaluationResult:
    transcript, blob = _extract_transcript(simulation_result)
    if not transcript:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "Could not locate the run transcript needed to check for "
                "unknown-subcommand failures."
            ),
        )

    records = _parse_tool_records(transcript)
    hits: list[str] = []
    for index, record in enumerate(records, start=1):
        detail = record.get("detail", "")
        for match in ADVERTISED_UNIMPLEMENTED_RE.finditer(detail):
            hits.append(f"tool call {index} invoked `{match.group(0)}`")

    if "Unknown research subcommand" in blob:
        hits.append('the transcript contains `"Unknown research subcommand"`')

    if hits:
        return EvaluationResult(
            score=0.0,
            feedback=(
                "The run reached a research subcommand the CLI does not "
                "implement: "
                + "; ".join(hits)
                + ". Implemented subcommands are: "
                + ", ".join(f"`{name}`" for name in IMPLEMENTED_RESEARCH_SUBCOMMANDS)
                + "."
            ),
        )

    return EvaluationResult(
        score=1.0,
        feedback="The run never invoked an unimplemented research subcommand.",
    )


environment = RELAIEnvironment(
    id="cli-help-self-consistency",
    name="CLI Help Matches Implemented Commands",
    description=(
        "Tests that the agentscience CLI's own help advertises only research "
        "subcommands its dispatcher actually implements, so an agent that "
        "trusts the documentation is not led onto a dead command."
    ),
    tags=TAGS,
    input=FixedInput(turns=[FixedTurn(content=TASK)]),
    mocks={},
    evaluators=[
        CodeEvaluator(
            id="top-level-help-consulted",
            description=(
                "Checks that the agent discovered the tool through its own "
                "top-level help, so skipping help cannot be used to dodge the "
                "self-consistency check."
            ),
            evaluate=_evaluate_top_level_help_consulted,
        ),
        CodeEvaluator(
            id="help-advertises-only-implemented-subcommands",
            description=(
                "Fails when captured CLI help output advertises a research "
                "subcommand the dispatcher rejects. Only fixable in the CLI."
            ),
            evaluate=_evaluate_help_advertises_only_implemented,
        ),
        CodeEvaluator(
            id="no-unimplemented-subcommand-invoked",
            description=(
                "Checks that the run never invokes a research subcommand the "
                "CLI does not implement."
            ),
            evaluate=_evaluate_no_unknown_subcommand,
        ),
    ],
)
