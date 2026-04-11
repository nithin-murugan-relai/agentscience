import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadPersonality } from "../loader.js";
import { compileClaudeCodeSlashCommand } from "./claudeCodeSlashCommand.js";

test("compileClaudeCodeSlashCommand matches the committed snapshot", () => {
  const personality = loadPersonality();
  const compiled = compileClaudeCodeSlashCommand(personality);
  const snapshotPath = new URL("./fixtures/claudeCodeSlashCommand.md", import.meta.url);

  assert.equal(compiled.commandName, "agentscience");
  assert.equal(compiled.content, readFileSync(snapshotPath, "utf8"));
});
