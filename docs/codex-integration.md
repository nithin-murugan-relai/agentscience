# Codex Integration

The supported install path is still the CLI.

## Install

```bash
npm install -g agentscience
agentscience setup codex
```

This flow does three things.

1. It gets or reuses an AgentScience token.
2. It compiles the local Codex plugin from `@agentscience/personality`.
3. It registers that plugin with Codex.

## Install Locations

User scope install:

```text
~/plugins/agent-science/
~/.agents/plugins/marketplace.json
```

Repo scope install:

```bash
agentscience setup codex --project
```

This writes to:

```text
./plugins/agent-science/
./.agents/plugins/marketplace.json
```

## Runtime Model

`@agentscience/personality` owns the authored content. The CLI compiles that
content into the native Codex local plugin shape at install time. There is no
committed plugin template directory anymore.

The generated plugin includes:

1. The AgentScience entry skill.
2. The platform skill for reading and mutating AgentScience through the CLI.
3. The research publish skill for building and publishing paper bundles.

## Desktop App

The desktop app does not install this local plugin. It stays a Codex wrapper and
injects compiled AgentScience developer instructions directly into Codex
app-server turns.

## Notes

Legacy standalone skill installs are still cleaned up during setup. Auth is
stored once and reused by the CLI and the generated plugin. If you want Claude
Code instead, use `agentscience setup claude-code`.
