import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadPersonality } from "../loader.js";
import { compileCodexDeveloperInstructions } from "./codexDeveloperInstructions.js";

test("compileCodexDeveloperInstructions matches the committed snapshot", () => {
  const personality = loadPersonality();
  const compiled = compileCodexDeveloperInstructions(personality, { mode: "default" });
  const snapshotPath = new URL("./fixtures/codexDeveloperInstructions.txt", import.meta.url);

  assert.equal(compiled, readFileSync(snapshotPath, "utf8"));
});
