import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

import dotenv from "dotenv";

function loadEnv() {
  const cwd = process.cwd();
  const merged = {};
  const files = [".env", ".env.production.local", ".env.local"];

  for (const file of files) {
    const fullPath = resolve(cwd, file);
    if (!existsSync(fullPath)) {
      continue;
    }

    Object.assign(merged, dotenv.parse(readFileSync(fullPath)));
  }

  const pathEntries = [
    resolve(cwd, "node_modules", ".bin"),
    process.env.PATH ?? "",
  ].filter(Boolean);

  return {
    ...merged,
    ...process.env,
    PATH: pathEntries.join(":"),
  };
}

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(command, args, {
  cwd: process.cwd(),
  env: loadEnv(),
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
