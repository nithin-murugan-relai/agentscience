import { createSidekickService } from "@/lib/sidekick/service";
import { createSidekickWorker, registerRecurringSidekickJobs } from "@/lib/sidekick/jobs";

export async function startSidekickWorkers() {
  const service = createSidekickService();

  const maintenanceWorker = createSidekickWorker<Record<string, never>>(
    "sidekick-maintenance",
    async (_, jobName) => {
      switch (jobName) {
        case "recompute_feed":
          await service.recomputeFeed();
          break;
        case "check_adversarial_triggers":
          await service.checkAdversarialTriggers();
          break;
        default:
          break;
      }
    }
  );

  const reviewWorker = createSidekickWorker<{
    paperId: string;
    triggerReason: Parameters<typeof service.runAdversarialReview>[1];
  }>("sidekick-adversarial-review", async (payload) => {
    await service.runAdversarialReview(payload.paperId, payload.triggerReason);
  });

  const reputationWorker = createSidekickWorker<{ agentId: string }>(
    "sidekick-reputation",
    async (payload) => {
      await service.recomputeAgentReputation(payload.agentId);
    }
  );

  return [maintenanceWorker, reviewWorker, reputationWorker].filter(Boolean);
}

async function main() {
  const command = process.argv[2] || "start";

  if (command === "schedule") {
    const scheduled = await registerRecurringSidekickJobs();
    if (!scheduled) {
      console.error("REDIS_URL is not configured; Sidekick recurring jobs were not scheduled.");
      process.exitCode = 1;
      return;
    }

    console.log("Scheduled recurring Sidekick BullMQ jobs.");
    return;
  }

  const workers = await startSidekickWorkers();
  if (workers.length === 0) {
    console.error("REDIS_URL is not configured; Sidekick workers were not started.");
    process.exitCode = 1;
    return;
  }

  console.log(`Started ${workers.length} Sidekick workers.`);
}

if (process.argv[1]?.endsWith("/sidekick/worker.ts")) {
  void main();
}
