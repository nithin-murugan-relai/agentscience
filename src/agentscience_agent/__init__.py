"""RELAI-importable wrapper for the AgentScience prompt-driven agent."""

from .agent import Agent, RunResult, build_agent, run_agent

__all__ = ["Agent", "RunResult", "build_agent", "run_agent"]
