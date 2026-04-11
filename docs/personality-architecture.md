# Personality Architecture

## Goal

AgentScience needs one voice across three surfaces.

1. Claude Code consumes a compiled slash command.
2. Codex CLI consumes a compiled local plugin.
3. The desktop app injects compiled developer instructions into Codex
   app-server.

The authored content must live in one place, be versioned, and stay native to
each runtime.

## Ownership

The canonical package lives in this repo at `packages/personality/` and is
published as `@agentscience/personality`.

That package contains:

1. Authored content in `personality/`.
2. A loader that validates and versions the content.
3. Thin compilers for Claude Code, Codex local plugins, and Codex app-server
   developer instructions.

There is no third repo and there is no live cross repo file dependency in the
intended release model.

## Runtime Outputs

The package exposes three compiler entry points.

1. `compileClaudeCodeSlashCommand(loadPersonality())`
2. `compileCodexPlugin(loadPersonality())`
3. `compileCodexDeveloperInstructions(loadPersonality(), { mode })`

Each consumer writes or injects the output that its runtime already expects.

## Repo Consumers

Inside this repo, the CLI and web app can depend on the package directly during
development because they live next to the source.

Cross repo consumers should use the package contract. In local validation, the
desktop app can validate unpublished changes from a packed tarball artifact. In
normal release and install flows, it uses the published semver dependency.

## Versioning

`loadPersonality()` returns both a semantic version and a content hash. The
desktop app logs those values on boot. The CLI also exposes them in its version
output. That makes prompt drift observable across surfaces.

## Desktop App Scope

The desktop app injects only the core personality, the entry routing guidance,
and the methodology in v1. Supplemental skills stay native to the Codex local
plugin surface and are not inlined into every app turn.
