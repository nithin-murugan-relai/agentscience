import assert from "node:assert/strict";
import test from "node:test";

import { compileClaudeCodeSlashCommand, loadPersonality } from "@agentscience/personality";

import { GET } from "./route";

test("GET /api/agent/methodology returns the compiled AgentScience slash command", async () => {
  const response = await GET();
  const expected = compileClaudeCodeSlashCommand(loadPersonality()).content;

  assert.equal(response.headers.get("content-type"), "text/markdown; charset=utf-8");
  assert.equal(await response.text(), expected);
});
