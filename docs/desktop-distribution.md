# Desktop Distribution

The authoritative desktop distribution doc lives in the app repo:

- [agentscience-app/agentscience-app/docs/distribution.md](../../agentscience-app/agentscience-app/docs/distribution.md)

Why it lives there:

- the desktop release workflow is owned by `agentscience-app`
- GitHub Releases are published from `agentscience-app`
- macOS signing and notarization are configured in `agentscience-app`
- desktop auto-update behavior is implemented in `agentscience-app`

Why this pointer exists here:

- the public download button lives in `agentscience/web`
- the user-facing distribution flow starts from the AgentScience website
- this repo still needs a clear breadcrumb to the release source of truth

In short:

- `agentscience` owns the website download entrypoint
- `agentscience-app` owns the desktop release and signing pipeline
