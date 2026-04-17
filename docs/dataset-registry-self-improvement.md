# Dataset Registry Self-Improvement

This document explains the dataset registry and the current "self-improving"
publish flow from a product point of view.

Audience: product and strategy. The goal is to make it easy to answer three
questions:

1. What is this idea trying to do?
2. What already exists in the product and codebase?
3. What still needs to be built?

## Important: what is implemented now

The short version:

- The dataset registry exists today.
- The registry can already be searched and manually added to from the CLI and
  API.
- The research methodology already tells agents to search the registry during
  dataset discovery.
- The publish flow now supports a structured `agentscience.publish.json`
  manifest that declares datasets used by the paper.
- `agentscience papers publish` now checks those declared datasets against the
  registry, distinguishes exact matches from likely duplicates, asks for
  confirmation, and adds approved datasets automatically after publish.
- Added registry entries are linked back to the published paper through
  `sourcePaperId` and use the publish-time paper score as `sourceRank` when it
  is available.
- The registry add path now deduplicates exact URL matches instead of creating
  duplicate entries silently.
- The desktop app instructions now tell agents to write the same
  `agentscience.publish.json` manifest in the manuscript workspace, so the app,
  Codex CLI, and Claude Code CLI all hand off to the same publish contract.

So the self-improving loop is now wired in end to end, with a few remaining
product refinements called out later in this document.

## What the dataset registry is

The dataset registry is a shared catalog of datasets that AgentScience agents
can search before starting a paper.

Conceptually, it is meant to be:

- a memory layer for good datasets discovered by previous research runs
- a quality filter, because entries should come from successful or credible work
- a way to make niche datasets compound over time instead of being rediscovered
  from scratch

In the current schema, each registry entry stores:

- dataset name
- dataset URL
- domain
- description
- keywords
- optional `sourcePaperId`
- optional `sourceRank`
- optional `addedBy`

This maps to the `DatasetEntry` model in `web/prisma/schema.prisma`.

## The holistic product idea

The big idea is not just "let users save datasets."

The bigger system is:

1. An agent does real work and produces a paper using a real dataset.
2. That paper passes the quality bar well enough to be worth publishing.
3. During publish, AgentScience notices which datasets powered the work.
4. If a useful dataset is not already in the registry, the system proposes
   adding it.
5. The user confirms.
6. The dataset is added to the registry, ideally linked to the paper that used
   it.
7. Future agents search the registry first and benefit from that accumulated
   knowledge.

That creates a compounding network effect:

- better papers add better datasets
- better datasets help future agents find better starting points
- future papers become stronger and more niche over time

This is why the TODO calls it "self-improvement." The platform gets smarter from
the output of good research.

## What is implemented today

### 1. Registry storage exists

There is a `DatasetEntry` table in Prisma with the fields needed for a registry
entry.

Relevant file:

- `web/prisma/schema.prisma`

### 2. Registry API exists

There is a public search endpoint, a publish-time check endpoint, and an
authenticated add endpoint:

- `GET /api/v1/registry`
- `POST /api/v1/registry/check`
- `POST /api/v1/registry`

Relevant file:

- `web/src/app/api/v1/registry/route.ts`

What this means in product terms:

- the backend can already store dataset entries
- the backend can already return dataset entries to clients
- the backend can already accept manual dataset additions

### 3. CLI registry commands exist

The CLI already supports:

- `agentscience registry search --query "..."`
- `agentscience registry list`
- `agentscience registry add --name ... --url ... --description ...`
- `agentscience papers publish` with `agentscience.publish.json` auto-detection
  or `--dataset-manifest ...`

Relevant files:

- `cli/bin/agentscience`
- `cli/lib/pipeline.mjs`

What this means in product terms:

- an agent or user can already inspect the registry
- an agent or user can already manually add a dataset
- the basic command surface is already there

### 4. The methodology already uses the registry in Stage 1

The research workflow already tells the agent to search the AgentScience dataset
registry first during dataset discovery.

Relevant file:

- `packages/personality/personality/methodology.md`

What this means in product terms:

- the registry is already part of the research story on the input side
- agents are already supposed to consume registry knowledge before looking on the
  open web

### 5. Paper publishing and registry sync are connected

The CLI can publish papers, upload workspace artifacts, read dataset manifests,
check the registry, prompt for confirmation, and add approved datasets back
into the registry through the same publish flow.

Relevant files:

- `cli/bin/agentscience`
- `web/src/app/api/v1/papers`

What this means in product terms:

- publishing works
- the registry works
- publish now feeds high-quality datasets back into the registry

## What changed to make the loop real

The self-improvement flow described in `todo.md` is now implemented end to end.

Specifically:

- Agents can declare datasets through `agentscience.publish.json`.
- Publish checks the registry through `POST /api/v1/registry/check`.
- Publish prompts before adding any new or likely-new dataset.
- Publish adds approved datasets automatically through the same CLI flow.
- Added entries link back to the published paper.
- Stage 4 in the methodology now explains that successful papers should feed
  the registry.
- Exact duplicate URLs are rejected and reused instead of creating noise.
- The current quality policy is explicit: only real datasets that materially
  supported the published paper and that the user approves should be proposed.

## What the user experience looks like now

This is the current publish experience implemented in the CLI-first flow.

### Stage A: agent finishes a good paper

Before publish, the system has enough context to know:

- the paper passed validation
- the paper used one or more real datasets
- the agent can describe those datasets well enough to propose registry entries

### Stage B: publish identifies dataset candidates

The publish flow collects structured dataset candidates from
`agentscience.publish.json`:

- name
- URL
- short description
- domain
- keywords
- optional source paper metadata

Today that manifest is the contract. Agents are expected to write it in the
workspace before publish.

### Stage C: publish checks the registry

For each candidate dataset, the system searches the registry and decides:

- already present
- maybe duplicate
- clearly new

### Stage D: user confirmation

If a dataset is new or likely new, publish asks:

"This paper used a dataset that is not yet in the AgentScience registry. Do you
want to add it?"

The proposed payload is shown before confirmation. In automated flows, the user
can opt in to auto-approval with `--yes-add-datasets`.

### Stage E: automatic add on confirmation

If the user confirms, publish calls `agentscience registry add`
automatically as part of the same publish experience. The paper publish itself
does not block on the user choosing to skip dataset insertion.

Important product detail:

- this should feel like one flow
- not "publish paper, then separately remember to run another command"

### Stage F: future research benefits

Later agents should discover that dataset through Stage 1 registry search.

That is the actual payoff. Without this last step, the registry is just a manual
database. With it, the platform compounds.

## How the system works end to end

From a systems perspective, the loop is:

1. Research uses the registry during discovery.
2. Research produces a paper using a real dataset.
3. Validation confirms the work is credible enough to publish.
4. Publish asks whether novel datasets used by the paper should be added.
5. The registry is enriched with those datasets.
6. Later research runs start with a stronger registry.

This creates a two-sided flywheel:

- input side: agents search the registry to find datasets
- output side: good papers contribute new datasets back to the registry

## Recommended product boundaries

To keep this idea manageable, the product should treat these as separate layers.

### Layer 1: registry primitive

Already implemented:

- store entries
- search entries
- manually add entries

### Layer 2: publish integration

Implemented today in the CLI publish path:

- detect datasets used by a paper
- check registry membership during publish
- ask user for confirmation
- add on confirmation

### Layer 3: quality policy

Partially implemented:

- the quality bar is "real dataset, materially used by the paper, user-approved"
- exact URL deduplication is implemented
- likely-duplicate detection is implemented with name and normalized-path
  heuristics
- `sourcePaperId` is populated on publish-time insert
- `sourceRank` is populated from the publish-time paper score when available

What is still not fully productized is policy sophistication, especially around
cross-mirror dataset families and stronger quality ranking rules.

## Current implementation shape

The implementation that now exists is:

### 1. Structured dataset metadata in the publish contract

Publish now receives declared datasets through a workspace manifest:

- `agentscience.publish.json` in the workspace root
- or `--dataset-manifest <file>` for an explicit path

Without that structured metadata, the rest of the flow would still be
guesswork, so the manifest is now the canonical handoff.

### 2. Publish-time registry check

During `agentscience papers publish`, the CLI now:

- search the registry for each declared dataset
- mark exact matches and likely duplicates
- build a list of candidate additions

### 3. Confirmation UX

The user explicitly confirms additions in the CLI. Automated flows can skip the
prompt with `--yes-add-datasets`, and they can disable the whole sync step with
`--skip-registry-sync`.

### 4. Registry entries link back to published papers

When a dataset is added from publish, the registry entry should include:

- `sourcePaperId`
- optionally `sourceRank` if that concept is available at the right time

That makes the registry more trustworthy and explorable.

### 5. Methodology update

Stage 4 should explicitly say that after a successful paper is ready for
publish, the agent should propose registry additions for high-quality datasets
that are not already present.

## Remaining gaps

These are the main things that are still incomplete or intentionally simple.

### Quality policy is still lightweight

Current policy:

- the dataset must be real
- the paper must have actually used it
- the user must approve the addition

Still open:

- whether some papers should be filtered out by stronger validation thresholds
- whether future ranking should favor datasets from stronger papers

### Duplicate handling is still heuristic

Handled today:

- exact same normalized URL
- same dataset name
- same normalized hostname-plus-path fingerprint

Still tricky:

- same dataset with different mirrors
- same dataset family with different versions
- same dataset name but different source

### Should the publish flow block on this?

Recommended answer:

- no, paper publish should succeed even if the user skips registry addition

This is already how the implementation behaves.

### The flow is CLI-first, not product-wide yet

Holistically, the behavior belongs to the publishing product, not just one
client surface.

What exists today:

- the CLI owns the actual publish-time registry sync
- the web/API provide the backing endpoints
- the desktop app now instructs agents to write the same manifest

What is still open:

- a native desktop-app confirmation UI for registry additions
- a first-class web publish UI that exposes the same dataset sync behavior
- richer provenance and review of registry insertions after publish

## Bottom line

The dataset registry is real and useful as a searchable catalog, and the
self-improving publish loop is now real too.

Successful papers can now feed new datasets back into that catalog during
publish without splitting the workflow into a second manual step.

What remains is mostly refinement: better duplicate policy, broader client
surfaces, and stronger quality policy. The core loop itself is no longer
the missing piece.
