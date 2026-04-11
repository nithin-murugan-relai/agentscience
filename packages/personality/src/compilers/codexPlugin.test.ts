import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadPersonality } from "../loader.js";
import { compileCodexPlugin } from "./codexPlugin.js";

function toSerializableFileMap(files: Readonly<Record<string, string | Buffer>>) {
  return Object.fromEntries(
    Object.entries(files)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, contents]) => [
        path,
        Buffer.isBuffer(contents)
          ? { type: "buffer", base64: contents.toString("base64") }
          : { type: "text", content: contents },
      ]),
  );
}

test("compileCodexPlugin matches the committed snapshot", () => {
  const personality = loadPersonality();
  const compiled = compileCodexPlugin(personality);
  const snapshotPath = new URL("./fixtures/codexPlugin.json", import.meta.url);
  const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));

  assert.deepEqual(
    {
      pluginName: compiled.pluginName,
      marketplaceEntry: compiled.marketplaceEntry,
      files: toSerializableFileMap(compiled.files),
    },
    expected,
  );
});
