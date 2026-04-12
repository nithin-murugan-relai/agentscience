# Codex Integration

The supported install path is still the CLI.

## Install

```bash
npm install -g agentscience
agentscience setup codex
```

This flow does three things.

1. It gets or reuses an AgentScience token.
2. It links the local Codex plugin to the packaged artifacts from `@agentscience/personality` when the runtime supports links.
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

`@agentscience/personality` owns the authored content. The CLI publishes native
Codex plugin artifacts from that package and setup points the local install at
those packaged outputs. There is no committed plugin template directory
anymore.

The generated plugin includes:

1. The AgentScience entry skill.
2. The platform skill for reading and mutating AgentScience through the CLI.
3. The research publish skill for building and publishing paper bundles.

## Updates

After the first setup, the preferred install mode is linked. That means a later
`agentscience` CLI update also refreshes the AgentScience plugin content without
requiring another full reinstall.

To inspect update state directly, run:

```bash
agentscience runtime status --json
```

If the runtime reports a stale local surface, rerun `agentscience setup codex`.

## Desktop App

The desktop app does not install this local plugin. It stays a Codex wrapper and
injects compiled AgentScience developer instructions directly into Codex
app-server turns.

## Notes

Legacy standalone skill installs are still cleaned up during setup. Auth is
stored once and reused by the CLI and the generated plugin. If you want Claude
Code instead, use `agentscience setup claude-code`.
