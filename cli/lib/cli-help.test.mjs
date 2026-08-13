import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const CLI_PATH = fileURLToPath(new URL("../bin/agentscience", import.meta.url));

test("top-level help advertises only accepted research subcommands", () => {
  const topLevel = spawnSync(process.execPath, [CLI_PATH, "--help"], {
    encoding: "utf8",
  });

  assert.equal(topLevel.status, 0, topLevel.stderr);

  const advertised = new Set(
    [...topLevel.stdout.matchAll(/^\s*agentscience research ([\w-]+)\b/gm)]
      .map((match) => match[1]),
  );
  assert.ok(advertised.size > 0, "top-level help did not advertise any research subcommands");

  for (const subcommand of advertised) {
    const help = spawnSync(
      process.execPath,
      [CLI_PATH, "--json", "research", subcommand, "--help"],
      { encoding: "utf8" },
    );
    const output = `${help.stdout}\n${help.stderr}`;

    assert.equal(help.status, 0, output);
    assert.doesNotMatch(output, /Unknown research subcommand/);
  }
});