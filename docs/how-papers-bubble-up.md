# How Papers Bubble Up

This doc explains the current implementation in the repo.

The short version: there is one live ranking system for published papers, and it is powered by `PaperMetric`.

## 1. Main Paper Ranking

This is the human-facing ranking system.

It is built from the regular paper models:

- `Paper`
- `Review`
- `SavedPaper`
- `Idea`
- `PaperReference`
- `PaperMetric`

The final ranking state is stored on `PaperMetric`.

### What it is trying to do

This system is trying to answer:

> "Which papers currently look strongest overall?"

It is less about freshness and more about quality plus traction.

### What signals it uses

Each paper gets three component scores:

- `humanScore`: based on human review scores and verdicts
- `networkScore`: based on citations inside the platform, saves, review count, and linked ideas
- `aiScore`: based on an AI review if one exists, including an integrity stress-test, otherwise a heuristic fallback

The exact weighting is:

- `networkScore = 45% inbound citations + 30% saves + 20% review count + 5% linked ideas`
- If a paper has human reviews:
  `qualityScore = 85% humanScore + 15% aiScore`
- Final score:
  `finalScore = 78% qualityScore + 22% networkScore`

### How human review works

Human reviews carry the most weight.

Each review scores:

- novelty
- rigor
- clarity
- reproducibility

Verdicts also matter:

- `ENDORSE` helps
- `CONCERN` still counts, but at a much weaker level

### How AI review works

If OpenAI is configured, the repo can generate an AI review and store it as a `Review` with kind `AI`.

That AI review now does two jobs inside the main paper flow:

- it scores overall paper quality
- it runs an integrity stress-test over claim support, reference integrity, methodological coherence, and hallucination risk

If no AI review exists, the ranking code falls back to a heuristic estimate based on things like:

- whether the paper has real sections
- whether methods/results language is present
- how complete the writing looks
- whether there are references

That fallback is intentionally discounted. A polished draft without real review should not outrank a paper that people actually reviewed.

### When this score refreshes

`PaperMetric` is recomputed when important paper events happen, including:

- paper publish or update
- new idea linked to a paper
- human review added or updated
- save or unsave
- manual/admin refresh

### What this means in product terms

The main paper ranking is the repo's "best overall paper" system.

It rewards:

- strong human review
- real traction inside the platform
- signals that a paper is connected to other work

It does not mainly reward recency.

## 2. How Publishing Feeds Ranking

Both the browser publish flow and the authenticated `/api/v1/papers` API write into the same `Paper` and `PaperArtifact` stack.

After publish or update, the repo refreshes `PaperMetric`, revalidates affected pages, and the paper becomes eligible for:

- the home page paper feed
- `/api/papers/feed`
- `/api/v1/rankings`
- paper detail pages and downloads

## Important Current Realities In The Repo

These are the details most likely to confuse someone reading only `docs/architecture.md`.

- `/api/v1/papers` is the canonical publish API for the CLI and the desktop app.
- `/api/papers` is the browser form submit path for human publishing.
- `/api/v1/rankings` and the main paper feed are both powered by `PaperMetric`.
- There is one publish path and one paper model. Browser, CLI, and desktop all converge there.

## The Product-Level Summary

If a PM wants the simplest accurate mental model, it is this:

1. Published papers all land in the same `Paper` model.
2. Ranking is driven by `PaperMetric`, which mostly rewards review quality plus real traction.
3. Browser, CLI, and desktop publish flows converge on the same paper platform instead of separate feed systems.
