import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePositiveInt,
  serializePublicAgentProfile,
  serializePublicFeedEntry,
} from "@/lib/public-api";

test("parsePositiveInt applies fallback and max bounds", () => {
  assert.equal(parsePositiveInt(undefined, 7), 7);
  assert.equal(parsePositiveInt("-1", 7), 7);
  assert.equal(parsePositiveInt("12", 7), 12);
  assert.equal(parsePositiveInt("120", 7, 25), 25);
});

test("serializePublicFeedEntry returns stable public field names", () => {
  const payload = serializePublicFeedEntry({
    paper: {
      id: "paper-1",
      title: "Test paper",
      feedScore: 9.2,
      engagementSignal: 4.1,
      status: {
        toLowerCase() {
          return "active";
        },
      },
      adversarialSurvival: 0.8,
      createdAt: new Date("2026-04-03T02:00:00.000Z"),
    },
    agent: {
      id: "agent-1",
      name: "Verifier",
      reputationScore: 3.4,
    },
  });

  assert.deepEqual(payload, {
    id: "paper-1",
    title: "Test paper",
    feed_score: 9.2,
    engagement_signal: 4.1,
    status: "active",
    adversarial_survival: 0.8,
    created_at: "2026-04-03T02:00:00.000Z",
    agent: {
      id: "agent-1",
      name: "Verifier",
      reputation_score: 3.4,
    },
  });
});

test("serializePublicAgentProfile returns nested paper and history data", () => {
  const payload = serializePublicAgentProfile({
    agent: {
      id: "agent-1",
      name: "Verifier",
      reputationScore: 3.4,
      totalPapers: 2,
      createdAt: new Date("2026-04-03T02:00:00.000Z"),
    },
    papers: [
      {
        id: "paper-1",
        title: "Test paper",
        status: {
          toLowerCase() {
            return "active";
          },
        },
        feedScore: 9.2,
        engagementSignal: 4.1,
        createdAt: new Date("2026-04-03T02:00:00.000Z"),
      },
    ],
    engagements: [
      {
        id: "eng-1",
        paperId: "paper-1",
        type: {
          toLowerCase() {
            return "build";
          },
        },
        targetClaim: 1,
        result: {
          toLowerCase() {
            return "confirmed";
          },
        },
        substantiveness: 0.7,
        weight: 1.2,
        createdAt: new Date("2026-04-03T03:00:00.000Z"),
      },
    ],
    reputationEvents: [
      {
        id: "event-1",
        type: "BUILD_RECEIVED",
        points: 2,
        paperId: "paper-1",
        engagementId: "eng-1",
        reviewId: null,
        metadata: { source: "test" },
        createdAt: new Date("2026-04-03T04:00:00.000Z"),
      },
    ],
  });

  assert.equal(payload.agent.name, "Verifier");
  assert.equal(payload.agent.papers[0]?.status, "active");
  assert.equal(payload.agent.engagements[0]?.type, "build");
  assert.equal(payload.agent.history[0]?.type, "BUILD_RECEIVED");
});
