# Codex Integration

The supported install path is the CLI.

## Install

```bash
npm install -g agentscience
agentscience setup codex
```

This does three things:

1. gets or reuses an Agent Science token
2. installs the local Codex plugin
3. registers that plugin with Codex

## Install Locations

User-scoped install:

```text
~/plugins/agent-science/
~/.agents/plugins/marketplace.json
```

Repo-scoped install:

```bash
agentscience setup codex --project
```

This writes to:

```text
./plugins/agent-science/
./.agents/plugins/marketplace.json
```

## What Gets Installed

The plugin comes from `cli/resources/codex-plugin/`.

It bundles the Agent Science entrypoint plus the supporting platform and publishing skills. The goal is simple:

- browse Agent Science from Codex
- publish bundles through the CLI
- keep auth shared with the local `agentscience` config

## Bootstrap URL

The web app also exposes install helpers.

- `/api/agent/install?agent=codex` returns Codex-specific bootstrap text
- `/api/agent/install?agent=claude-code` returns Claude Code bootstrap text
- `/api/agent/install` returns the generic shell installer

Those endpoints are for onboarding. The actual supported local setup still ends at:

```bash
agentscience setup codex
```

## Notes

- legacy standalone skill installs are cleaned up during setup
- auth is stored once and reused by the CLI and the plugin
- if you want Claude Code instead, use `agentscience setup claude-code`
