import assert from "node:assert/strict";
import test from "node:test";

import {
  inferDatasetTopicSlugs,
  INTERDISCIPLINARY_TOPIC_SLUG,
  type InferableDatasetTopic,
} from "@/lib/dataset-topic-inference";

const topics: InferableDatasetTopic[] = [
  {
    id: "topic_interdisciplinary",
    slug: "interdisciplinary",
    name: "Interdisciplinary",
    area: "OTHER",
    description: null,
    agentInstructions: null,
  },
  {
    id: "topic_neuroscience",
    slug: "neuroscience",
    name: "Neuroscience",
    area: "LIFE_SCIENCES",
    description: null,
    agentInstructions: null,
  },
  {
    id: "topic_public_health",
    slug: "public-health",
    name: "Public Health",
    area: "MEDICINE_HEALTH",
    description: null,
    agentInstructions: null,
  },
  {
    id: "topic_pharmacology",
    slug: "pharmacology",
    name: "Pharmacology",
    area: "MEDICINE_HEALTH",
    description: null,
    agentInstructions: null,
  },
  {
    id: "topic_neuroimaging",
    slug: "neuroimaging",
    name: "Neuroimaging",
    area: "LIFE_SCIENCES",
    description: null,
    agentInstructions: null,
  },
];

test("inferDatasetTopicSlugs prefers specific signals over interdisciplinary fallback", () => {
  const slugs = inferDatasetTopicSlugs(
    {
      name: "PRISM Repurposing Public 23Q2",
      description:
        "Broad PRISM repurposing screen release used for exploratory pharmacology in B-ALL.",
      keywords: ["prism", "drug screen", "repurposing", "pharmacology"],
      providerName: "Doi",
      providerTopicSlugs: [INTERDISCIPLINARY_TOPIC_SLUG],
      providerIsCanonical: false,
    },
    topics,
  );

  assert.deepEqual(slugs, ["pharmacology"]);
});

test("inferDatasetTopicSlugs can assign multiple specific areas from dataset metadata", () => {
  const slugs = inferDatasetTopicSlugs(
    {
      name: "National Survey of Children's Health",
      description:
        "Annual child health survey public-use files pooled across 2016-2024 to study smoking exposure and functional burden in pediatric epilepsy.",
      keywords: [
        "survey",
        "secondhand smoke",
        "health disparities",
        "pediatric epilepsy",
      ],
      providerName: "Census",
      providerTopicSlugs: [INTERDISCIPLINARY_TOPIC_SLUG],
      providerIsCanonical: false,
      sourcePaperTitle:
        "Household Cigarette Exposure and Functional Burden in Pediatric Epilepsy",
    },
    topics,
  );

  assert.deepEqual(slugs, ["public-health", "neuroscience"]);
});

test("inferDatasetTopicSlugs falls back to canonical provider topics when the text is thin", () => {
  const slugs = inferDatasetTopicSlugs(
    {
      name: "OpenNeuro ds077777",
      description: "Open dataset.",
      keywords: [],
      providerName: "OpenNeuro",
      providerTopicSlugs: ["neuroimaging", "neuroscience"],
      providerIsCanonical: true,
    },
    topics,
  );

  assert.deepEqual(slugs, ["neuroimaging", "neuroscience"]);
});
