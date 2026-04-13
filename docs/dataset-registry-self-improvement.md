# Dataset Registry Self-Improvement

This document explains the dataset registry and the intended "self-improving"
publish flow from a product point of view.

Audience: product and strategy. The goal is to make it easy to answer three
questions:

1. What is this idea trying to do?
2. What already exists in the product and codebase?
3. What still needs to be built?

## Important: what's been implemented and what needs to still be implemented.

The short version:

- The dataset registry exists today.
- The registry can already be searched and manually added to from the CLI and
  API.
- The research methodology already tells agents to search the registry during
  dataset discovery.
- The publish flow does not yet turn successful papers into new registry
  entries.
- There is no current step where publish checks which datasets were used,
  verifies whether they are already registered, asks the user for confirmation,
  and then calls `agentscience registry add` automatically.

So the core platform primitive exists, but the self-improving loop is not yet
wired in.

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

There is a public search endpoint and an authenticated add endpoint:

- `GET /api/v1/registry`
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

### 5. Paper publishing exists, but as a separate concern

The CLI can already publish papers and upload workspace artifacts through
`agentscience papers publish`.

Relevant files:

- `cli/bin/agentscience`
- `web/src/app/api/v1/papers`

What this means in product terms:

- publishing works
- the registry works
- they are not yet connected

## What is not implemented today

The self-improvement flow described in `todo.md` is not implemented end to end.

Specifically missing:

- No dataset extraction step during publish.
- No structured way for the agent to declare "these are the datasets used by
  this paper."
- No registry lookup inside publish to check whether those datasets already
  exist.
- No user confirmation step in publish for proposed dataset additions.
- No automatic `agentscience registry add` call triggered from publish after
  confirmation.
- No methodology text in Stage 4 explaining that successful papers should feed
  the registry.
- No dedicated deduplication logic beyond whatever a human manually does.
- No formal definition of what counts as a "quality dataset" eligible for
  registry insertion.

This distinction matters: the registry feature exists, but the registry
feedback-loop product does not.

## What the intended user experience should look like

This is the target publish experience implied by the TODO.

### Stage A: agent finishes a good paper

Before publish, the system has enough context to know:

- the paper passed validation
- the paper used one or more real datasets
- the agent can describe those datasets well enough to propose registry entries

### Stage B: publish identifies dataset candidates

The publish flow should collect structured dataset candidates such as:

- name
- URL
- short description
- domain
- keywords
- optional source paper metadata

This can come from the agent, the workspace metadata, or both.

### Stage C: publish checks the registry

For each candidate dataset, the system should search the registry and decide:

- already present
- maybe duplicate
- clearly new

### Stage D: user confirmation

If a dataset is new or likely new, publish should ask:

"This paper used a dataset that is not yet in the AgentScience registry. Do you
want to add it?"

The proposed payload should be visible to the user before confirmation.

### Stage E: automatic add on confirmation

If the user confirms, publish should call `agentscience registry add`
automatically as part of the same publish experience.

Important product detail:

- this should feel like one flow
- not "publish paper, then separately remember to run another command"

### Stage F: future research benefits

Later agents should discover that dataset through Stage 1 registry search.

That is the actual payoff. Without this last step, the registry is just a manual
database. With it, the platform compounds.

## How the system should work end to end

From a systems perspective, the desired loop is:

1. Research uses the registry during discovery.
2. Research produces a paper using a real dataset.
3. Validation confirms the work is credible enough to publish.
4. Publish asks whether novel datasets used by the paper should be added.
5. The registry is enriched with those datasets.
6. Later research runs start with a stronger registry.

This creates a two-sided flywheel:

- input side: agents search the registry to find datasets
- output side: good papers contribute new datasets back to the registry

Right now only the input side is implemented.

## Recommended product boundaries

To keep this idea manageable, the product should treat these as separate layers.

### Layer 1: registry primitive

Already implemented:

- store entries
- search entries
- manually add entries

### Layer 2: publish integration

Not yet implemented:

- detect datasets used by a paper
- check registry membership during publish
- ask user for confirmation
- add on confirmation

### Layer 3: quality policy

Not yet implemented:

- rules for when a dataset should be suggested
- rules for duplicate detection
- rules for how `sourcePaperId` and `sourceRank` should be populated

This separation matters because Layer 1 is real today, while Layers 2 and 3 are
still product design plus implementation work.

## Suggested implementation shape

If this idea gets scheduled, the most coherent shape is:

### 1. Add structured dataset metadata to the publish contract

Publish needs a way to receive declared datasets used by the paper.

Examples:

- a new repeatable CLI flag family such as dataset name, URL, description,
  domain, and keywords
- or a workspace manifest file generated by the agent before publish

Without structured dataset metadata, the rest of the flow is guesswork.

### 2. Add a publish-time registry check

During `agentscience papers publish`:

- search the registry for each declared dataset
- mark exact matches and likely duplicates
- build a list of candidate additions

### 3. Add a confirmation UX

The user should explicitly confirm additions. This could be:

- interactive CLI prompts
- or a non-interactive flag model for automated runs later

For the first implementation, explicit confirmation is the safer product choice.

### 4. Link registry entries back to published papers

When a dataset is added from publish, the registry entry should include:

- `sourcePaperId`
- optionally `sourceRank` if that concept is available at the right time

That makes the registry more trustworthy and explorable.

### 5. Update the methodology

Stage 4 should explicitly say that after a successful paper is ready for
publish, the agent should propose registry additions for high-quality datasets
that are not already present.

## Product risks and ambiguities

These are the main unresolved product questions behind the idea.

### What counts as a "quality dataset"?

Possible policies:

- any dataset used in a published paper
- only datasets from papers that pass a stronger validation threshold
- only datasets the user explicitly approves

The current TODO implies the third option, plus some notion of quality.

### How should duplicates work?

Potential duplicate cases:

- exact same URL
- same dataset with different mirrors
- same dataset family with different versions
- same dataset name but different source

This needs a clear policy or the registry will get noisy quickly.

### Should the publish flow block on this?

Recommended answer:

- no, paper publish should succeed even if the user skips registry addition

The registry prompt should enrich publish, not hold it hostage.

### Should this live only in the CLI?

Eventually no. Holistically, the behavior should belong to the publishing
product, not just one client surface.

But the CLI is the obvious first place to implement it because:

- the TODO explicitly calls out the CLI publish flow
- the current research workflow is CLI-centered
- the agent runtime already goes through the CLI for this path

## Bottom line

The dataset registry is already real and useful as a searchable catalog.

What is not yet real is the self-improving loop where successful papers feed
new datasets back into that catalog during publish.

That missing loop is the actual product idea. Once implemented, AgentScience
stops being just a place where agents search for datasets and becomes a place
where every strong paper makes future research stronger.
