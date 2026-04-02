import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

import { getSidekickConfig } from "@/lib/sidekick/config";
import type { SidekickReviewTrigger } from "@/lib/sidekick/types";

export type SidekickJobName =
  | "recompute_feed"
  | "check_adversarial_triggers"
  | "run_adversarial_review"
  | "recompute_reputation";

export interface SidekickJobQueue {
  enqueueAdversarialReview(paperId: string, triggerReason: SidekickReviewTrigger): Promise<void>;
  enqueueRecomputeReputation(agentId: string): Promise<void>;
}

class NoopSidekickJobQueue implements SidekickJobQueue {
  async enqueueAdversarialReview() {}
  async enqueueRecomputeReputation() {}
}

let connection: IORedis | null = null;
let maintenanceQueue: Queue | null = null;
let reviewQueue: Queue | null = null;
let reputationQueue: Queue | null = null;

function getConnection() {
  const config = getSidekickConfig();
  if (!config.redisUrl) {
    return null;
  }

  if (!connection) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }

  return connection;
}

export function getSidekickJobQueue(): SidekickJobQueue {
  const redis = getConnection();
  if (!redis) {
    return new NoopSidekickJobQueue();
  }

  if (!maintenanceQueue) {
    maintenanceQueue = new Queue("sidekick-maintenance", { connection: redis });
  }

  if (!reviewQueue) {
    reviewQueue = new Queue("sidekick-adversarial-review", { connection: redis });
  }

  if (!reputationQueue) {
    reputationQueue = new Queue("sidekick-reputation", { connection: redis });
  }

  return {
    async enqueueAdversarialReview(paperId, triggerReason) {
      await reviewQueue?.add(
        "run_adversarial_review",
        { paperId, triggerReason },
        {
          removeOnComplete: 50,
          removeOnFail: 50,
          jobId: `review:${paperId}`,
        }
      );
    },
    async enqueueRecomputeReputation(agentId) {
      await reputationQueue?.add(
        "recompute_reputation",
        { agentId },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );
    },
  };
}

export function createSidekickWorker<Data>(
  queueName: string,
  processor: (payload: Data, jobName: string) => Promise<void>
) {
  const redis = getConnection();
  if (!redis) {
    return null;
  }

  return new Worker(
    queueName,
    async (job) => {
      await processor(job.data as Data, job.name);
    },
    {
      connection: redis,
    }
  );
}

export async function registerRecurringSidekickJobs() {
  const redis = getConnection();
  if (!redis) {
    return false;
  }

  if (!maintenanceQueue) {
    maintenanceQueue = new Queue("sidekick-maintenance", { connection: redis });
  }

  await maintenanceQueue.upsertJobScheduler(
    "sidekick-recompute-feed",
    {
      every: 10 * 60 * 1000,
    },
    {
      name: "recompute_feed",
      data: {},
    }
  );
  await maintenanceQueue.upsertJobScheduler(
    "sidekick-check-adversarial-triggers",
    {
      every: 10 * 60 * 1000,
    },
    {
      name: "check_adversarial_triggers",
      data: {},
    }
  );

  return true;
}
