"""Score an agent answer with DiscoveryBench's OWN evaluator.

The point of this module is that the number it returns is not ours. It calls
`run_eval_gold_vs_gen_NL_hypo_workflow` from the DiscoveryBench repo, unmodified,
which is the metric published results on that benchmark use.

The simulator adapter calls this after each run so the optimizer trains on the
benchmark's verdict rather than on a proxy we invented. That mirrors the DeepSWE
harness, where the adapter runs the real verifier and passes its reward through.

Two deviations to disclose in any writeup:

* The paper pins `gpt-4-1106-preview`, which OpenRouter does not serve. We use
  `openai/gpt-4-turbo`, its closest available successor. Both arms of any
  comparison are judged by the same model.
* `final_score` is a strict product gated on context matching, so it is 0.0 for
  most baseline answers. The graded components are returned alongside it; use
  those for a training signal and report `final_score` as the headline.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

DISCOVERYBENCH_ROOT = Path(
    os.environ.get(
        "DISCOVERYBENCH_ROOT",
        str(Path.home() / "developer/benchmarking/discoverybench"),
    )
)
JUDGE_MODEL = os.environ.get("DB_JUDGE_MODEL", "openai/gpt-4-turbo")
_KEY_FALLBACK = Path.home() / "developer/benchmarking/deep-swe/.env"


def _api_key() -> str | None:
    key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if key:
        return key
    try:
        for line in _KEY_FALLBACK.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip().strip("'\"")
    except OSError:
        pass
    return None


def _load_evaluator():
    """Import the benchmark's evaluator, configuring the client it constructs.

    `eval.new_eval` builds a bare `OpenAI()`, which reads credentials from the
    environment, so pointing those at OpenRouter needs no edit to their code.
    """
    key = _api_key()
    if not key:
        raise RuntimeError(
            "no OPENROUTER_API_KEY/OPENAI_API_KEY available for the DiscoveryBench judge"
        )
    os.environ["OPENAI_API_KEY"] = key
    os.environ.setdefault("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")

    if not (DISCOVERYBENCH_ROOT / "eval" / "new_eval.py").exists():
        raise RuntimeError(
            f"DiscoveryBench evaluator not found under {DISCOVERYBENCH_ROOT}; "
            "set DISCOVERYBENCH_ROOT"
        )
    root = str(DISCOVERYBENCH_ROOT)
    if root not in sys.path:
        sys.path.insert(0, root)

    from eval.new_eval import run_eval_gold_vs_gen_NL_hypo_workflow

    return run_eval_gold_vs_gen_NL_hypo_workflow


def _components(record: dict[str, Any]) -> dict[str, Any]:
    """Pull the graded parts the benchmark computes on the way to final_score."""
    out: dict[str, Any] = {
        "final_score": float(record.get("final_score") or 0.0),
        "recall_context": float(record.get("recall_context") or 0.0),
        "mean_accuracy_score": float(record.get("mean_accuracy_score") or 0.0),
    }
    variable_scores: list[float] = []
    relationship_scores: list[float] = []
    for entry in (record.get("matched_gold_gen_subh_evals") or {}).values():
        if not isinstance(entry, dict):
            continue
        for key, value in entry.items():
            if not isinstance(value, dict):
                continue
            score = value.get("score")
            # `rel` scores a scalar; `var` scores a {p, r, f1} dict.
            if isinstance(score, dict):
                score = score.get("f1", score.get("r"))
            if not isinstance(score, (int, float)):
                continue
            if "var" in key.lower():
                variable_scores.append(float(score))
            elif "rel" in key.lower():
                relationship_scores.append(float(score))
    out["variable_score"] = (
        sum(variable_scores) / len(variable_scores) if variable_scores else 0.0
    )
    out["relationship_score"] = (
        sum(relationship_scores) / len(relationship_scores)
        if relationship_scores
        else 0.0
    )
    return out


def metadata_from_columns(
    columns: str, description: str = "", dataset_type: str = "synth"
) -> dict[str, Any]:
    """Build the `dataset_meta` shape the evaluator expects from a column string.

    Input looks like `"name (what it is); other_name (what it is)"`. The
    evaluator indexes `dataset_meta["datasets"]` and, for the synth split, reads
    a flat `columns` list of `{name, description}`; the real split nests the same
    list under a `raw` key.
    """
    parsed: list[dict[str, str]] = []
    for part in (columns or "").split(";"):
        part = part.strip()
        if not part:
            continue
        if "(" in part and part.endswith(")"):
            name, _, desc = part.partition("(")
            parsed.append({"name": name.strip(), "description": desc[:-1].strip()})
        else:
            parsed.append({"name": part, "description": ""})
    entry: dict[str, Any] = {
        "name": "data.csv",
        "description": description or "Dataset provided with the research question.",
    }
    entry["columns"] = {"raw": parsed} if dataset_type == "real" else parsed
    return {"datasets": [entry]}


def score_answer(
    question: str,
    gold_hypothesis: str,
    agent_answer: str,
    dataset_metadata: dict[str, Any] | None = None,
    dataset_type: str = "synth",
) -> dict[str, Any]:
    """Return DiscoveryBench's verdict for one answer.

    On success the dict carries `final_score` plus the graded components. On
    failure it carries `scoring_error` and zeroed scores, so a judge outage is
    distinguishable from a genuinely bad answer rather than silently scoring 0.
    """
    if not agent_answer or not agent_answer.strip():
        return {
            "final_score": 0.0,
            "recall_context": 0.0,
            "mean_accuracy_score": 0.0,
            "variable_score": 0.0,
            "relationship_score": 0.0,
            "scoring_error": None,
            "note": "agent produced no answer",
        }
    try:
        evaluate = _load_evaluator()
        record = evaluate(
            query=question,
            gold_hypo=gold_hypothesis,
            gold_workflow="",
            gen_hypo=agent_answer,
            gen_workflow="",
            dataset_meta=dataset_metadata or {},
            llm_used=JUDGE_MODEL,
            dataset_type=dataset_type,
            use_column_metadata=bool(dataset_metadata),
        )
    except Exception as exc:  # judge outage, import failure, malformed response
        return {
            "final_score": 0.0,
            "recall_context": 0.0,
            "mean_accuracy_score": 0.0,
            "variable_score": 0.0,
            "relationship_score": 0.0,
            "scoring_error": f"{type(exc).__name__}: {exc}"[:400],
        }

    out = _components(record if isinstance(record, dict) else {})
    out["scoring_error"] = None
    out["judge_model"] = JUDGE_MODEL
    return out
