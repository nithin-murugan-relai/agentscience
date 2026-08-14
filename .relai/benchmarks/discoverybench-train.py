from __future__ import annotations

from relai import (
    FixedInput,
    FixedTurn,
    LLMJudgeEvaluator,
    ModelSpec,
    RELAIBenchmark,
    RELAIEnvironment,
    StoredBenchmarkCsv,
)


JUDGE_MODEL = ModelSpec(name="gpt-5.4")
REQUIRED_COLUMNS = [
    "task_id",
    "question",
    "data_path",
    "columns",
    "expected_finding",
]


def _required_text(row_fields, key: str) -> str:
    value = row_fields.get(key)
    if isinstance(value, str):
        text = value.strip()
    elif value is None:
        text = ""
    else:
        text = str(value).strip()
    if not text:
        raise ValueError(f"Benchmark row is missing required `{key}`.")
    return text


def _display_name(task_id: str) -> str:
    stem = task_id.split("_", 1)[0]
    return stem.replace("-", " ").title()


def _build_task(question: str, data_path: str, columns: str) -> str:
    return (
        f"Research question: {question}\n\n"
        f"Data is in this directory:\n{data_path}\n\n"
        f"Columns:\n{columns}\n\n"
        "Analyze the data and state what you find. Name the variables involved "
        "and the direction or form of any supported relationship. If the data "
        "does not support a finding, say so clearly. End with one plain "
        "conclusion sentence that a reader could quote as the finding."
    )


def _judge_instructions(
    question: str,
    columns: str,
    expected_finding: str,
) -> str:
    return (
        "Grade the agent's final answer for a DiscoveryBench-style data-analysis "
        "task. Read only the final answer when scoring; do not award credit for "
        "intermediate transcript work.\n\n"
        f"Research question:\n{question}\n\n"
        f"Available columns:\n{columns}\n\n"
        f"Expected finding:\n{expected_finding}\n\n"
        "Use exactly these three equally weighted criteria:\n"
        "1. Variables: Does the answer name the same quantities the expected "
        "finding is about? Accept either dataset column names or faithful plain-"
        "English renderings.\n"
        "2. Direction or form: Does the answer commit to the relationship's "
        "direction or functional form, including a clear no-relationship or "
        "cannot-determine conclusion when that is what the data supports?\n"
        "3. Stated plainly: Can a reader lift one plain sentence from the answer "
        "that states the finding?\n\n"
        "Scoring:\n"
        "- Score 1.0 only if all three criteria pass.\n"
        "- Score 0.67 if exactly two criteria pass.\n"
        "- Score 0.33 if exactly one criterion passes.\n"
        "- Score 0.0 if none pass.\n\n"
        "Feedback rules:\n"
        "- If score is below 1.0, identify each failed criterion by name.\n"
        "- For each failed criterion, describe the observed issue that caused the "
        "deduction and what full-credit behavior required.\n"
        "- Include decisive expected-vs-observed detail from the expected finding "
        "when useful.\n"
        "- Say whether the problem is wrong content, missing required content, "
        "extra hedging without a finding, or a missing plain conclusion sentence "
        "when those distinctions matter.\n"
        "- If score is 1.0, give one concise sentence explaining why the answer "
        "earned full credit."
    )


def build_environment(row_fields, sample_index):
    task_id = _required_text(row_fields, "task_id")
    question = _required_text(row_fields, "question")
    data_path = _required_text(row_fields, "data_path")
    columns = _required_text(row_fields, "columns")
    expected_finding = _required_text(row_fields, "expected_finding")

    del sample_index

    return RELAIEnvironment(
        id=task_id,
        name=f"{_display_name(task_id)} Finding",
        description=(
            "Tests whether the agent analyzes the provided dataset and states the "
            "supported finding plainly."
        ),
        tags=["end-to-end"],
        input=FixedInput(
            turns=[
                FixedTurn(
                    content=_build_task(
                        question=question,
                        data_path=data_path,
                        columns=columns,
                    )
                )
            ]
        ),
        mocks={},
        evaluators=[
            LLMJudgeEvaluator(
                id="state-supported-finding",
                description=(
                    "Scores whether the final answer names the right variables, "
                    "states the supported relationship form, and ends with one "
                    "plain finding sentence."
                ),
                instructions=_judge_instructions(
                    question=question,
                    columns=columns,
                    expected_finding=expected_finding,
                ),
                model=JUDGE_MODEL,
            )
        ],
    )


benchmark = RELAIBenchmark(
    schema_version="relai.benchmark.v1",
    id="discoverybench-train",
    name="discoverybench-train",
    description=(
        "DiscoveryBench training tasks that require AgentScience to analyze a "
        "provided CSV-backed fixture and state the supported finding plainly."
    ),
    dataset_ref=StoredBenchmarkCsv(id="ad439732-61d6-4a51-96f1-6866567f6dae"),
    agent_target="agentscience",
    required_columns=REQUIRED_COLUMNS,
    build_environment=build_environment,
)
