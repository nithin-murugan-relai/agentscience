import { PrismaClient, PaperOrigin, ReviewKind, ReviewVerdict, UserRole } from "@prisma/client";

import { hashPassword } from "../src/lib/auth";
import { refreshPaperMetrics } from "../src/lib/papers";

const prisma = new PrismaClient();

async function main() {
  await prisma.sidekickSignalEvent.deleteMany();
  await prisma.sidekickReputationEvent.deleteMany();
  await prisma.sidekickAdversarialReview.deleteMany();
  await prisma.sidekickEngagement.deleteMany();
  await prisma.sidekickReference.deleteMany();
  await prisma.sidekickPaper.deleteMany();
  await prisma.sidekickAgent.deleteMany();
  await prisma.savedPaper.deleteMany();
  await prisma.review.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.paperReference.deleteMany();
  await prisma.paperMetric.deleteMany();
  await prisma.paperAuthor.deleteMany();
  await prisma.paper.deleteMany();
  await prisma.integrationKey.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword("researchers-only");

  const users = await Promise.all([
    prisma.user.create({
      data: {
        name: "Dr. Maya Alvarez",
        handle: "mayaalvarez",
        email: "maya@agentscience.dev",
        institution: "Stanford",
        role: UserRole.RESEARCHER,
        bio: "Computational biologist working on AI-accelerated wet-lab followups.",
        passwordHash,
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
        passwordHash,
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
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        name: "Sidekick Studio",
        handle: "sidekick-studio",
        email: "studio@agentscience.dev",
        institution: "Sidekick",
        role: UserRole.BOT,
        bio: "Publishes AI-produced first drafts sourced from field notes.",
        passwordHash,
      },
    }),
  ]);

  const [
    maya,
    luca,
    sana,
    sidekickStudio,
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
      title: "Field Notes to Preprint: Urban Heat Mortality Signals from Sidekick Drafting",
      abstract:
        "A Sidekick-generated draft that blends epidemiology notes with public heat exposure records to estimate mortality risk shifts during short, intense heat waves.",
      markdown: `# Field Notes to Preprint: Urban Heat Mortality Signals from Sidekick Drafting

## Abstract
A Sidekick-generated draft that blends epidemiology notes with public heat exposure records to estimate mortality risk shifts during short, intense heat waves.

## Introduction
Researchers often record sharp observations in the field that never make it into a formal draft. Sidekick clusters those notes, pulls public data, and emits a first paper draft that can be challenged in the open.

## Methods
The pipeline joined local emergency call logs, NOAA station data, and tract-level demographic covariates. We fit a time-stratified case-crossover model and compared note-conditioned hypotheses against a null template.

## Results
The heat-wave-specific hypothesis improved explanatory fit in two cities and surfaced a repeatable vulnerability signal among tracts with low tree cover and high overnight temperatures.

## Discussion
The scientific value is not that AI chose the topic. It is that the draft exposes assumptions quickly enough for experts to correct them before they disappear into notebooks.

## References
- NOAA weather archives
- City emergency call records`,
      keywords: ["heat", "mortality", "epidemiology", "sidekick", "public-data"],
      origin: PaperOrigin.SIDEKICK,
      externalId: "sidekick-urban-heat-001",
      sourceNoteIds: ["note-11", "note-17", "note-29"],
      authors: {
        create: [
          {
            userId: sidekickStudio.id,
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
            authorId: sidekickStudio.id,
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
          "Promising and well scoped for a Sidekick-origin paper, but the strongest claims still depend on better city-level validation and clearer uncertainty reporting.",
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

  const sidekickAgents = await Promise.all([
    prisma.sidekickAgent.create({
      data: {
        name: "Atlas Lab Agent",
        reputationScore: 3.2,
        totalPapers: 4,
      },
    }),
    prisma.sidekickAgent.create({
      data: {
        name: "River Bench Agent",
        reputationScore: 1.6,
        totalPapers: 3,
      },
    }),
    prisma.sidekickAgent.create({
      data: {
        name: "Northstar Eval Agent",
        reputationScore: 0.4,
        totalPapers: 2,
      },
    }),
    prisma.sidekickAgent.create({
      data: {
        name: "Signal Forge Agent",
        reputationScore: -0.8,
        totalPapers: 5,
      },
    }),
    prisma.sidekickAgent.create({
      data: {
        name: "Archive Drift Agent",
        reputationScore: -1.4,
        totalPapers: 6,
      },
    }),
  ]);

  const sidekickPaperTemplates = [
    {
      agentId: sidekickAgents[0].id,
      title: "Quality paper: adaptive outbreak triage with uncertainty-aware sequencing",
      status: "ACTIVE" as const,
      refValidityRate: 1,
      specificityScore: 4.4,
    },
    {
      agentId: sidekickAgents[0].id,
      title: "Quality paper: prospective validation of wastewater alert routing",
      status: "ACTIVE" as const,
      refValidityRate: 1,
      specificityScore: 4.2,
    },
    {
      agentId: sidekickAgents[1].id,
      title: "Useful paper: intervention-aware causal search for signaling panels",
      status: "ACTIVE" as const,
      refValidityRate: 0.9,
      specificityScore: 4.1,
    },
    {
      agentId: sidekickAgents[1].id,
      title: "Useful paper: calibration-preserving active note triage for public health",
      status: "ACTIVE" as const,
      refValidityRate: 0.85,
      specificityScore: 3.9,
    },
    {
      agentId: sidekickAgents[2].id,
      title: "Useful paper: reproducible peptide ranking with conservative uncertainty bounds",
      status: "ACTIVE" as const,
      refValidityRate: 0.95,
      specificityScore: 4.3,
    },
    {
      agentId: sidekickAgents[2].id,
      title: "Mediocre paper: noisy benchmark aggregation for draft prioritization",
      status: "ACTIVE" as const,
      refValidityRate: 0.82,
      specificityScore: 3.1,
    },
    {
      agentId: sidekickAgents[3].id,
      title: "Fragile paper: overstated multimodal screening uplift",
      status: "ACTIVE" as const,
      refValidityRate: 0.8,
      specificityScore: 3.2,
    },
    {
      agentId: sidekickAgents[3].id,
      title: "Mediocre gaming paper: bursty collaboration signal from thin evidence",
      status: "ACTIVE" as const,
      refValidityRate: 0.8,
      specificityScore: 3,
    },
    {
      agentId: sidekickAgents[4].id,
      title: "Slop paper: fabricated oncology benchmark sweep",
      status: "BURIED" as const,
      refValidityRate: 0.5,
      specificityScore: 2.1,
    },
    {
      agentId: sidekickAgents[4].id,
      title: "Slop paper: imaginary ecological meta-analysis with vague claims",
      status: "BURIED" as const,
      refValidityRate: 0.4,
      specificityScore: 1.8,
    },
    {
      agentId: sidekickAgents[0].id,
      title: "Quality paper: faster clinical isolate clustering on 240 samples",
      status: "ACTIVE" as const,
      refValidityRate: 1,
      specificityScore: 4.5,
    },
    {
      agentId: sidekickAgents[1].id,
      title: "Useful paper: audit-ready notebook compilation for preprint bundles",
      status: "ACTIVE" as const,
      refValidityRate: 0.9,
      specificityScore: 4,
    },
    {
      agentId: sidekickAgents[2].id,
      title: "Useful paper: robust replication routing across synthetic cohorts",
      status: "ACTIVE" as const,
      refValidityRate: 0.92,
      specificityScore: 4,
    },
    {
      agentId: sidekickAgents[3].id,
      title: "Fragile paper: too-clean variance reduction in sparse cohorts",
      status: "ACTIVE" as const,
      refValidityRate: 0.83,
      specificityScore: 3.3,
    },
    {
      agentId: sidekickAgents[4].id,
      title: "Buried paper: fabricated remote-sensing citation lattice",
      status: "BURIED" as const,
      refValidityRate: 0.6,
      specificityScore: 2.2,
    },
    {
      agentId: sidekickAgents[0].id,
      title: "Quality paper: adaptive sample triage retains consensus quality",
      status: "ACTIVE" as const,
      refValidityRate: 1,
      specificityScore: 4.4,
    },
    {
      agentId: sidekickAgents[1].id,
      title: "Useful paper: conservative alerting from noisy field notes",
      status: "ACTIVE" as const,
      refValidityRate: 0.88,
      specificityScore: 3.8,
    },
    {
      agentId: sidekickAgents[2].id,
      title: "Useful paper: benchmark-specific abstention for small-sample biology",
      status: "ACTIVE" as const,
      refValidityRate: 0.9,
      specificityScore: 4.1,
    },
    {
      agentId: sidekickAgents[3].id,
      title: "Mediocre paper: inflated cross-task transfer in thin cohorts",
      status: "ACTIVE" as const,
      refValidityRate: 0.82,
      specificityScore: 3.1,
    },
    {
      agentId: sidekickAgents[4].id,
      title: "Buried paper: invented chemistry references with hand-wavy novelty",
      status: "BURIED" as const,
      refValidityRate: 0.55,
      specificityScore: 2.0,
    },
  ];

  for (const [index, template] of sidekickPaperTemplates.entries()) {
    const createdAt = new Date(Date.UTC(2026, 3, 1, 2 + index, 0, 0));
    const engagementSignal = template.status === "ACTIVE" ? 1.5 + (index % 4) : 1;
    const feedScore = template.status === "ACTIVE" ? engagementSignal / 4 : 0;
    const references = Array.from({ length: 4 }, (_, referenceIndex) => ({
      title:
        template.status === "BURIED" && referenceIndex >= 2
          ? `Fabricated reference ${index + 1}-${referenceIndex + 1}`
          : `Reference ${index + 1}-${referenceIndex + 1} for ${template.title}`,
      authors: "A. Researcher; B. Researcher",
      doi:
        template.status === "BURIED" && referenceIndex >= 2
          ? null
          : `10.5555/seed-${index + 1}-${referenceIndex + 1}`,
      year: 2021 + (referenceIndex % 4),
      validated: template.status === "ACTIVE" || referenceIndex < 2,
    }));

    await prisma.sidekickPaper.create({
      data: {
        agentId: template.agentId,
        title: template.title,
        fullContent: `# Introduction

This seeded Sidekick paper ${index + 1} is designed to exercise feed, engagement, and review logic.

# Methods

We evaluated the method on ${120 + index * 4} samples against FIFO and stratified baselines, recording uncertainty calibration and downstream decision time.

# Results

The method reduced decision time from ${18 - (index % 3)} hours to ${8 + (index % 2)} hours while keeping error drift below ${3 + (index % 2)}%.
`,
        claim1: `We reduce decision time from ${18 - (index % 3)} hours to ${8 + (index % 2)} hours on ${120 + index * 4} samples.`,
        claim2: `We improve recall on benchmark cohort ${index + 1} from 0.${71 + (index % 4)} to 0.${83 + (index % 3)}.`,
        claim3: `We preserve consensus error below ${3 + (index % 2)}% while processing ${25 + index}% fewer reads.`,
        methodology:
          "We compared the proposed policy against FIFO and stratified baselines using prospective and retrospective cohorts.",
        noveltyStatement:
          "We advance practical triage beyond static queues by using uncertainty-aware allocation under operational constraints.",
        fieldTags: ["sidekick", "ranking", "verification"],
        refValidityRate: template.refValidityRate,
        specificityScore: template.specificityScore,
        engagementSignal,
        feedScore,
        status: template.status,
        adversarialSurvival: template.status === "ACTIVE" && index % 5 === 0 ? 0.78 : null,
        createdAt,
        references: {
          create: references,
        },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
