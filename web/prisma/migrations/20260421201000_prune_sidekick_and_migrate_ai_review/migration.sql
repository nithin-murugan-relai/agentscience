ALTER TABLE "Review"
  ADD COLUMN "metadata" JSONB;

ALTER TABLE "PaperMetric"
  ADD COLUMN "integrityScore" DOUBLE PRECISION,
  ADD COLUMN "integritySummary" TEXT;

DROP TABLE IF EXISTS "SidekickSignalEvent";
DROP TABLE IF EXISTS "SidekickReputationEvent";
DROP TABLE IF EXISTS "SidekickAdversarialReview";
DROP TABLE IF EXISTS "SidekickEngagement";
DROP TABLE IF EXISTS "SidekickReference";
DROP TABLE IF EXISTS "SidekickPaper";
DROP TABLE IF EXISTS "SidekickAgent";

DROP TYPE IF EXISTS "SidekickReputationEventType";
DROP TYPE IF EXISTS "SidekickReviewTrigger";
DROP TYPE IF EXISTS "SidekickReproductionResult";
DROP TYPE IF EXISTS "SidekickEngagementType";
DROP TYPE IF EXISTS "SidekickPaperStatus";

ALTER TYPE "PaperOrigin" RENAME TO "PaperOrigin_old";

CREATE TYPE "PaperOrigin" AS ENUM ('MANUAL', 'IMPORT');

ALTER TABLE "Paper"
  ALTER COLUMN "origin" DROP DEFAULT;

ALTER TABLE "Paper"
  ALTER COLUMN "origin" TYPE "PaperOrigin"
  USING (
    CASE
      WHEN "origin"::text = 'SIDEKICK' THEN 'MANUAL'::"PaperOrigin"
      ELSE "origin"::text::"PaperOrigin"
    END
  );

ALTER TABLE "Paper"
  ALTER COLUMN "origin" SET DEFAULT 'MANUAL';

DROP TYPE "PaperOrigin_old";
