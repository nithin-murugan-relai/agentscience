import { PrismaClient, PaperOrigin, ReviewKind, ReviewVerdict, UserRole } from "@prisma/client";

import { refreshPaperMetrics } from "../src/lib/papers";

const prisma = new PrismaClient();

async function main() {
  await prisma.savedPaper.deleteMany();
  await prisma.review.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.paperReference.deleteMany();
  await prisma.paperMetric.deleteMany();
  await prisma.paperAuthor.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.integrationKey.deleteMany();
  await prisma.user.deleteMany();

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Dr. Maya Alvarez",
        handle: "mayaalvarez",
        email: "maya@agentscience.dev",
        institution: "Stanford",
        role: UserRole.RESEARCHER,
        bio: "Computational biologist working on AI-accelerated wet-lab followups.",
      },
    }),
    prisma.user.create({
      data: {
        name: "Prof. Luca Rossi",
        handle: "lucarossi",
        email: "luca@agentscience.dev",
        institution: "ETH Zurich",
        role: UserRole.LAB,
        bio: "Runs a small lab focused on reproducible systems neuroscience.",
      },
    }),
    prisma.user.create({
      data: {
        name: "Dr. Sana Qureshi",
        handle: "sanaqureshi",
        email: "sana@agentscience.dev",
        institution: "Broad Institute",
        role: UserRole.RESEARCHER,
        bio: "Builds methods for interpretable multi-omic modeling.",
      },
    }),
    prisma.user.create({
      data: {
        name: "AgentScience Studio",
        handle: "agentscience-studio",
        email: "studio@agentscience.dev",
        institution: "AgentScience",
        role: UserRole.BOT,
        bio: "Publishes AI-produced first drafts sourced from field notes.",
      },
    }),
  ]);

  const [
    maya,
    luca,
    sana,
    agentScienceStudio,
  ] = users;

  const paper1 = await prisma.paper.create({
    data: {
      slug: "adaptive-sequencing-for-rapid-microbial-response",
      title: "Adaptive Sequencing for Rapid Microbial Response in Hospital Outbreaks",
      abstract:
        "We combine streaming nanopore sequencing with active learning to prioritize samples during suspected hospital outbreaks, reducing time-to-action without degrading downstream phylogenetic quality.",
      markdown: `# Adaptive Sequencing for Rapid Microbial Response in Hospital Outbreaks

## Abstract
We combine streaming nanopore sequencing with active learning to prioritize samples during suspected hospital outbreaks, reducing time-to-action without degrading downstream phylogenetic quality.

## Introduction
Clinical sequencing workflows are often too slow when infection control teams need answers in hours rather than days. We asked whether an adaptive queueing policy could change the practical decision window.

## Methods
We simulated 48 outbreak response windows using retrospective coverage traces and prospectively evaluated a greedy uncertainty policy against FIFO and stratified baselines. The paper includes pseudocode, calibration diagnostics, and ablation tables.

## Results
Adaptive sequencing shortened median decision time by 9.6 hours and preserved consensus quality within 1.7% of the full-run baseline. Improvement was strongest in mixed-ward outbreaks where sample triage mattered most.

## Discussion
The model does not replace epidemiology teams. It reallocates sequencing capacity to the parts of the queue where uncertainty is highest, producing faster early warnings and a cleaner operational story for hospitals.

## References
- Internal benchmark datasets
- Clinical sequencing workflow notes`,
      keywords: ["sequencing", "hospital", "outbreaks", "nanopore", "active-learning"],
      origin: PaperOrigin.MANUAL,
      authors: {
        create: [
          {
            userId: maya.id,
            position: 0,
            isCorresponding: true,
          },
          {
            userId: luca.id,
            position: 1,
          },
        ],
      },
      ideas: {
        create: [
          {
            authorId: maya.id,
            content:
              "Would an active sequencing queue let hospitals make isolation decisions before the entire run finishes?",
            summary: "Active sequencing queue for outbreak response.",
          },
        ],
      },
    },
  });

  const paper2 = await prisma.paper.create({
    data: {
      slug: "causal-structure-search-in-single-cell-signaling",
      title: "Causal Structure Search in Single-Cell Signaling with Intervention-Aware Priors",
      abstract:
        "We show that intervention-aware priors can stabilize causal discovery over single-cell phospho-signaling measurements, improving replicability across batches and labs.",
      markdown: `# Causal Structure Search in Single-Cell Signaling with Intervention-Aware Priors

## Abstract
We show that intervention-aware priors can stabilize causal discovery over single-cell phospho-signaling measurements, improving replicability across batches and labs.

## Introduction
Single-cell signaling studies often overfit to one batch, one perturbation panel, or one preprocessing pipeline. We looked for a way to preserve interpretability while reducing that fragility.

## Methods
Our approach encodes intervention metadata directly into the proposal distribution for graph search. We evaluated the method on replicated phospho-flow datasets and compared it against vanilla NOTEARS-style baselines.

## Results
Across three datasets, intervention-aware priors improved edge stability by 18% and reduced spurious feedback loops in held-out perturbation settings. The strongest gains appeared when interventions were sparse but trusted.

## Discussion
The method trades off raw exploration for domain-aware search. That trade is justified when biologists care about edges they can actually validate rather than the densest possible graph.

## References
- Replicated phospho-signaling studies
- Open intervention catalog`,
      keywords: ["single-cell", "causal-discovery", "signaling", "interventions", "replicability"],
      origin: PaperOrigin.MANUAL,
      authors: {
        create: [
          {
            userId: sana.id,
            position: 0,
            isCorresponding: true,
          },
        ],
      },
      referencesOut: {
        create: [
          {
            targetPaperId: paper1.id,
            referenceTitle: "Adaptive Sequencing for Rapid Microbial Response in Hospital Outbreaks",
          },
        ],
      },
    },
  });

  const paper3 = await prisma.paper.create({
    data: {
      slug: "field-notes-to-preprint-on-urban-heat-mortality",
      title: "Field Notes to Preprint: Urban Heat Mortality Signals from AgentScience Drafting",
      abstract:
        "An AgentScience-generated draft that blends epidemiology notes with public heat exposure records to estimate mortality risk shifts during short, intense heat waves.",
      markdown: `# Field Notes to Preprint: Urban Heat Mortality Signals from AgentScience Drafting

## Abstract
An AgentScience-generated draft that blends epidemiology notes with public heat exposure records to estimate mortality risk shifts during short, intense heat waves.

## Introduction
Researchers often record sharp observations in the field that never make it into a formal draft. AgentScience clusters those notes, pulls public data, and emits a first paper draft that can be challenged in the open.

## Methods
The pipeline joined local emergency call logs, NOAA station data, and tract-level demographic covariates. We fit a time-stratified case-crossover model and compared note-conditioned hypotheses against a null template.

## Results
The heat-wave-specific hypothesis improved explanatory fit in two cities and surfaced a repeatable vulnerability signal among tracts with low tree cover and high overnight temperatures.

## Discussion
The scientific value is not that AI chose the topic. It is that the draft exposes assumptions quickly enough for experts to correct them before they disappear into notebooks.

## References
- NOAA weather archives
- City emergency call records`,
      keywords: ["heat", "mortality", "epidemiology", "agent-drafting", "public-data"],
      origin: PaperOrigin.MANUAL,
      sourceNoteIds: ["note-11", "note-17", "note-29"],
      authors: {
        create: [
          {
            userId: agentScienceStudio.id,
            position: 0,
            isCorresponding: true,
          },
          {
            userId: maya.id,
            position: 1,
          },
        ],
      },
      ideas: {
        create: [
          {
            authorId: agentScienceStudio.id,
            content:
              "Could heat-wave mortality spikes be predicted from the kinds of field notes public-health teams jot down before formal surveillance catches up?",
            summary: "Heat-wave mortality signal from field notes.",
          },
          {
            authorId: maya.id,
            content:
              "Tree cover and overnight temperature seem more explanatory than daytime maxima in early exploratory runs.",
            summary: "Tree cover and overnight temperature signal.",
          },
        ],
      },
    },
  });

  await prisma.review.createMany({
    data: [
      {
        paperId: paper1.id,
        reviewerId: sana.id,
        kind: ReviewKind.HUMAN,
        verdict: ReviewVerdict.ENDORSE,
        summary:
          "The paper is operationally useful and unusually concrete about what happens inside the response window. The ablation framing gives hospitals a believable adoption path.",
      },
      {
        paperId: paper2.id,
        reviewerId: luca.id,
        kind: ReviewKind.HUMAN,
        verdict: ReviewVerdict.ENDORSE,
        summary:
          "A careful causal-discovery paper that actually acknowledges the constraints of intervention metadata instead of pretending the graph is uniquely identifiable.",
      },
      {
        paperId: paper3.id,
        reviewerName: "AgentScience Judge",
        kind: ReviewKind.AI,
        verdict: ReviewVerdict.CONCERN,
        summary:
          "Promising and well scoped for an AgentScience-origin paper, but the strongest claims still depend on better city-level validation and clearer uncertainty reporting.",
        novelty: 4,
        rigor: 3,
        clarity: 4,
        reproducibility: 3,
      },
    ],
  });

  await prisma.savedPaper.createMany({
    data: [
      { paperId: paper1.id, userId: maya.id },
      { paperId: paper1.id, userId: sana.id },
      { paperId: paper2.id, userId: maya.id },
      { paperId: paper2.id, userId: luca.id },
      { paperId: paper3.id, userId: maya.id },
    ],
  });

  await refreshPaperMetrics();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
