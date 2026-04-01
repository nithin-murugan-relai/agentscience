# Sidekick Social: Overnight Agent Build Prompt

## Context: What You Are and Where You Live

You are a Codex agent with full agentic access to this computer. You can use the entire file system, Chrome, web search, terminal, and anything else you need. There is nothing important on this machine that you can break, so operate freely and confidently.

You sit inside the **Sidekick Social** repository. **Sidekick** (the iPhone app) and **Sidekick Social** (the companion social network) live under the same GitHub folder structure within this repo. Explore the full working tree to orient yourself before doing anything.

### What Is Sidekick?

Sidekick is an iPhone app for scientists. Scientists have limited time in the lab and only work on certain projects. But they have tons of other ideas they never get to pursue. Sidekick lets them write down those ideas, and then AI automatically implements them into real, publishable research: full LaTeX papers with `.bib` files, figures, proper sections, the works. Archive-ready PDFs.

### What Is Sidekick Social?

Sidekick Social is the companion social network. Scientists use the Sidekick iPhone app to publish their AI-generated (and human-approved) research papers to Sidekick Social. Think of it as a living, breathing feed of real science, powered by both humans and agents.

### Current State of Sidekick Social

- A basic web UI exists
- A database is wired up
- It is deployed on Vercel
- It looks nice visually
- Sidekick is not yet ready to push papers to Sidekick Social, but we are kickstarting Sidekick Social development independently
- **No CLI exists yet**
- **No agent-facing programmatic interface exists yet**
- **No OpenClaw integration exists yet**
- **Papers currently render as markdown, which is unacceptable for a research platform**

---

## Your Mission

You will build out Sidekick Social into a fully functional, agent-forward scientific publishing and research platform. You will not stop until every item in the final checklist is provably complete. This is an overnight task. Run until it is done.

---

## Phase 1: Rich Agent-Facing CLI

This is the highest priority. The core belief driving Sidekick Social is that the majority of traffic will come from agents, not humans. Every single piece of functionality that a human can access through the web UI must be replicated through a rich, descriptive, self-documenting command-line interface.

### Requirements

1. **Complete feature parity with the UI.** Anything a human can do on the website, an agent must be able to do via CLI. This includes (but is not limited to):
   - Browsing and searching papers
   - Reading full paper content
   - Posting/publishing new papers
   - Commenting on papers
   - Viewing and interacting with user profiles
   - Viewing GitHub source code links associated with papers
   - Fetching paper metadata (authors, date, tags, citations, figures)
   - Downloading papers and associated files

2. **Self-documenting and discoverable.** The CLI must be so rich, so descriptive, and so helpful that an agent encountering Sidekick Social for the first time (with zero prior knowledge, since Sidekick Social will not be in any model's training data) can programmatically figure out everything it needs to do without ever loading the website UI or taking screenshots. This means:
   - Thorough `--help` output on every command and subcommand
   - A top-level `sidekick-social --help` that gives a clear overview of what the platform is and what you can do
   - Rich descriptions, examples, and explanations baked into the help text
   - Consistent, predictable command structure
   - Machine-parseable output formats (JSON by default, with human-readable options)

3. **API-backed.** The CLI should talk to the same backend/database that the web UI uses. Do not create a separate data layer. If an agent posts a paper via CLI, it shows up on the website, and vice versa.

4. **Authentication.** Implement API key or token-based auth so agents can authenticate programmatically.

---

## Phase 2: OpenClaw Agent Integration

The ideal user is a researcher who already has an OpenClaw agent running and is frustrated that OpenClaw is stuck doing basic tasks like WhatsApp messaging and email automation. They want OpenClaw to do something real: actual science.

### Requirements

1. **Research the OpenClaw framework.** Use web search to understand how OpenClaw agents work, how they integrate with external services, what their plugin/tool architecture looks like, and how their memory management ("heartbeat sessions") functions. Also look into Hermes and other popular agent frameworks, but OpenClaw is the primary target.

2. **Build an OpenClaw-to-Sidekick-Social connector.** This should allow an OpenClaw agent to:
   - Authenticate with Sidekick Social
   - Pull down papers from the feed
   - Search for papers by topic, author, or keyword
   - Read full paper contents
   - Post new papers (with LaTeX source, figures, `.bib` files, and GitHub repo links)
   - Comment on existing papers
   - Access all CLI functionality programmatically

3. **Make connection easy.** Whether it is a plugin, a tool definition, an MCP server, or whatever pattern is most native to OpenClaw, the connection method should be agent-forward and programmatic. No manual UI steps required.

4. **Document the integration thoroughly.** An OpenClaw user should be able to follow clear instructions to hook their agent up to Sidekick Social.

---

## Phase 3: The Research Pipeline

Build the full pipeline so that an agent (OpenClaw or otherwise) can conduct completely novel research and publish it to Sidekick Social.

### The Pipeline Must Support

1. **Idea generation.** The agent, using its deep knowledge of the user (via OpenClaw's memory/heartbeat features), can proactively generate scientific ideas and present them to the user for approval.

2. **User-submitted ideas.** A user should be able to text or message their OpenClaw agent with an idea, and the agent turns that idea into a full research paper.

3. **Research execution.** The agent should be able to:
   - Conduct literature reviews (via web search, pulling papers from Sidekick Social, etc.)
   - Design methodology
   - Run experiments or analyses (using the user's computer/file system)
   - Generate figures and visualizations
   - Write up results

4. **Paper generation.** The output must be a proper LaTeX document, not markdown. The pipeline must produce:
   - A `.tex` file with proper structure (abstract, introduction, methodology, results, discussion, conclusion, references)
   - A `.bib` file with real citations
   - Generated figures (as image files referenced in the LaTeX)
   - A compiled PDF that looks like a real arXiv paper

5. **Publishing to Sidekick Social.** The agent pushes the completed paper (PDF, LaTeX source, figures, bib file) to Sidekick Social via the CLI/API.

6. **GitHub integration.** Every paper published must have an associated GitHub repository (or link to one) containing the source code used to produce the research. This must be visible both in the web UI and accessible via CLI. Real scientists need to be able to pull down the code and reproduce results.

---

## Phase 4: Paper Rendering on the Website

The current markdown rendering is unacceptable. Research papers on Sidekick Social must look like real research papers.

### Requirements

1. **LaTeX-to-PDF pipeline.** Papers should be stored as LaTeX source and rendered/served as PDFs.

2. **PDF viewing in the web UI.** When a user browses Sidekick Social, they should see beautifully rendered PDF papers with proper formatting: two-column layouts (or single-column, depending on template), real figures, proper citations and references, numbered equations, the whole thing. Use an embedded PDF viewer or a LaTeX-to-HTML rendering pipeline, whichever produces the most professional result.

3. **No more markdown rendering for papers.** Markdown is fine for comments and descriptions, but the paper itself must render as a proper academic document.

---

## Phase 5: Social Features and UI Parity

1. **Commenting system.** Users (both human and agent) must be able to comment on papers. Comments should be visible in the web UI and accessible via CLI.

2. **Daily digest / proactive summaries.** Build the infrastructure so that an OpenClaw agent can:
   - Pull the most interesting/relevant recent papers from Sidekick Social (based on the user's interests and history)
   - Generate a short, readable daily summary
   - Deliver it to the user (the delivery mechanism depends on how OpenClaw handles notifications, but the Sidekick Social side of this must be built)
   - Users must be able to configure whether they want this or not

3. **Every UI element has a CLI equivalent.** This is repeated intentionally because it is critical. If you add any new UI feature, it must have a corresponding CLI command. No exceptions.

---

## Phase 6: Documentation and Discoverability

1. **README for Sidekick Social.** Clear, comprehensive, covering:
   - What Sidekick Social is
   - How to use the web UI
   - Full CLI documentation with examples
   - How to connect an OpenClaw agent
   - How the research pipeline works
   - How GitHub integration works

2. **In-CLI documentation.** As described above, the CLI must be self-documenting enough that a naive agent can figure everything out.

3. **OpenClaw integration guide.** Step-by-step.

---

## Design Principles (Follow These Throughout)

- **Agent-forward.** Every decision should prioritize agent usability. Agents are first-class citizens, not an afterthought.
- **Real science, real formatting.** No shortcuts on paper quality. LaTeX, proper citations, real figures. This is what gives Sidekick Social credibility.
- **Simplicity where possible.** For things like GitHub integration, choose the simplest approach that works. Do not over-engineer.
- **Full parity.** UI and CLI must always be in sync. Never build a UI feature without its CLI counterpart.
- **Proactive, not reactive.** The platform should empower agents to be proactive: suggesting ideas, summarizing feeds, initiating research, not just responding to commands.

---

## Operating Instructions

1. **Start by exploring the full repository.** Understand the existing codebase, database schema, Vercel deployment setup, and current UI before writing any code.
2. **Work incrementally.** Build, test, verify each phase before moving to the next.
3. **Use web search freely** to research OpenClaw, LaTeX tooling, PDF rendering libraries, or anything else you need.
4. **Commit your work** to the repository as you go. Use clear, descriptive commit messages.
5. **Test everything.** Every CLI command should work. Every API endpoint should respond correctly. The web UI should render papers properly. The OpenClaw integration should function end-to-end.
6. **Do not stop until the checklist below is fully complete.**

---

## FINAL VERIFICATION CHECKLIST

You must go through this checklist sequentially. For each item, you must produce concrete, verifiable proof that it is complete: show command output, demonstrate a working endpoint, confirm a rendered page, or whatever is appropriate. You do not stop running until every single item below is provably done.

### CLI Foundation
- [ ] **1.1** A `sidekick-social` CLI tool exists and is executable from the terminal.
- [ ] **1.2** Running `sidekick-social --help` prints a comprehensive overview of the platform and all available commands, descriptive enough that an agent with zero prior knowledge of Sidekick Social can understand what it is and how to use it.
- [ ] **1.3** Every subcommand has its own `--help` with descriptions, argument explanations, and usage examples.
- [ ] **1.4** The CLI supports JSON output by default for machine parseability, with a `--human` or `--pretty` flag for human-readable output.
- [ ] **1.5** CLI authentication exists via API key or token. Demonstrate by authenticating and performing an authenticated action.

### CLI Feature Parity
- [ ] **2.1** CLI can list/browse all papers on Sidekick Social. Demonstrate by running the command and showing output.
- [ ] **2.2** CLI can search papers by keyword, topic, or author. Demonstrate with a search query.
- [ ] **2.3** CLI can read the full content of a specific paper (metadata + body). Demonstrate.
- [ ] **2.4** CLI can post/publish a new paper (accepting LaTeX source, bib file, figures, and GitHub repo link). Demonstrate by posting a test paper and confirming it appears in the database.
- [ ] **2.5** CLI can comment on a paper. Demonstrate by posting a comment and retrieving it.
- [ ] **2.6** CLI can view and interact with user profiles. Demonstrate.
- [ ] **2.7** CLI can download papers and their associated files (PDF, LaTeX, bib, figures). Demonstrate.
- [ ] **2.8** CLI can view the GitHub source code link for any paper. Demonstrate.

### OpenClaw Integration
- [ ] **3.1** Research on OpenClaw is complete. Document a summary of how OpenClaw works, its plugin/tool architecture, and its memory management features.
- [ ] **3.2** An OpenClaw-compatible connector/plugin/tool definition for Sidekick Social exists.
- [ ] **3.3** The connector allows an OpenClaw agent to authenticate with Sidekick Social.
- [ ] **3.4** The connector allows pulling, searching, reading, posting, and commenting on papers.
- [ ] **3.5** Integration documentation exists with step-by-step setup instructions.

### Research Pipeline
- [ ] **4.1** A pipeline exists for an agent to generate scientific ideas (given user context/interests).
- [ ] **4.2** A pipeline exists for a user to submit an idea (as text) and have it turned into a research plan.
- [ ] **4.3** The pipeline can conduct literature review by searching the web and Sidekick Social.
- [ ] **4.4** The pipeline produces a complete LaTeX paper with: `.tex` file (proper academic structure), `.bib` file with citations, generated figures, and a compiled PDF.
- [ ] **4.5** The pipeline can publish the completed paper to Sidekick Social via the CLI/API. Demonstrate end-to-end: idea in, paper on Sidekick Social out.
- [ ] **4.6** Every published paper has an associated GitHub repository link containing reproducible source code. Demonstrate that this link is visible in both UI and CLI.

### Paper Rendering
- [ ] **5.1** Papers on the Sidekick Social website render as proper academic documents (PDF or LaTeX-to-HTML), not markdown. Demonstrate by loading a paper page and confirming the rendering.
- [ ] **5.2** Rendered papers show proper academic formatting: sections, figures, citations, references, equations (if applicable).
- [ ] **5.3** Markdown rendering is no longer the default for paper content on the site.

### Social Features
- [ ] **6.1** Commenting system works in the web UI. Demonstrate by posting and viewing a comment on a paper.
- [ ] **6.2** Commenting system works via CLI (already covered in 2.5, but confirm the round-trip: CLI comment appears in UI, UI comment appears in CLI).
- [ ] **6.3** Infrastructure for daily digest/summary exists: an API endpoint or CLI command that returns the most relevant recent papers for a given user, with short summaries.
- [ ] **6.4** Users can configure whether they want proactive summaries (a settings flag in their profile, accessible via both UI and CLI).

### Documentation
- [ ] **7.1** A comprehensive README exists for Sidekick Social covering: what it is, web UI usage, full CLI docs with examples, OpenClaw integration guide, research pipeline overview, and GitHub integration explanation.
- [ ] **7.2** The CLI's built-in help text is thorough enough that an agent can operate the entire platform without reading any external docs. Verify by confirming every command and subcommand has descriptive help.
- [ ] **7.3** A dedicated OpenClaw integration guide exists with step-by-step instructions.

### Integration and Consistency
- [ ] **8.1** Every feature accessible in the web UI has a corresponding CLI command. Enumerate all UI features and their CLI counterparts to prove parity.
- [ ] **8.2** The CLI and web UI share the same backend/database. Demonstrate by creating something via CLI and confirming it appears in the UI (and vice versa).
- [ ] **8.3** All code is committed to the repository with clear commit messages.
- [ ] **8.4** The Vercel deployment still works and the site is accessible. Confirm by loading the deployed URL.

---

**You are done only when every single checkbox above has been checked off with concrete proof. If even one item is incomplete or broken, keep working. Do not stop.**
