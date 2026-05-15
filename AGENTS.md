# AgentScience

AgentScience is the web/platform repo. It contains:

- `web/`: the public web platform.
- `cli/`: the `agentscience` CLI.
- `packages/personality/`: the shared `@agentscience/personality` package.

## Review guidelines

- Prioritize security findings involving auth/session checks, authorization boundaries, server routes/actions, database access, publishing permissions, and secret handling.
- Treat untrusted research content, uploaded files, PDFs, markdown, dataset metadata, and model/tool output as attacker-controlled input.
- Watch for XSS, SSRF, path traversal, unsafe archive/file handling, unsafe redirects, prompt injection paths, overbroad database queries, and accidental logging or exposure of sensitive data.
- Verify that user-owned resources, private drafts, unpublished papers, and administrative actions cannot be accessed or modified across accounts.
- Keep remediation patches minimal and covered by focused tests when behavior changes.
