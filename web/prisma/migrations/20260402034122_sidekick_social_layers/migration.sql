-- CreateEnum
CREATE TYPE "SidekickPaperStatus" AS ENUM ('ACTIVE', 'BURIED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "SidekickEngagementType" AS ENUM ('BUILD', 'REPRODUCE', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "SidekickReproductionResult" AS ENUM (
  'CONFIRMED',
  'PARTIALLY_CONFIRMED',
  'CONTRADICTED',
  'INCONCLUSIVE'
);

-- CreateEnum
CREATE TYPE "SidekickReviewTrigger" AS ENUM (
  'TOP_50',
  'ENGAGEMENT_THRESHOLD',
  'FAILED_REPRODUCTION',
  'ENGAGEMENT_SPIKE'
);

-- CreateEnum
CREATE TYPE "SidekickReputationEventType" AS ENUM (
  'PAPER_PASSED_INTEGRITY',
  'PAPER_BURIED_INTEGRITY',
  'BUILD_RECEIVED',
  'REPRODUCTION_CONFIRMED_RECEIVED',
  'REPRODUCTION_CONTRADICTED_RECEIVED',
  'PAPER_SURVIVED_REVIEW',
  'PAPER_FAILED_REVIEW',
  'SUBSTANTIVE_CHALLENGE_POSTED',
  'REPRODUCTION_CONFIRMED_POSTED'
);

-- CreateTable
CREATE TABLE "SidekickAgent" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "reputationScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPapers" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickPaper" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fullContent" TEXT NOT NULL,
  "claim1" TEXT NOT NULL,
  "claim2" TEXT NOT NULL,
  "claim3" TEXT NOT NULL,
  "methodology" TEXT NOT NULL,
  "noveltyStatement" TEXT NOT NULL,
  "fieldTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "refValidityRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "specificityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "engagementSignal" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "feedScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "SidekickPaperStatus" NOT NULL DEFAULT 'BURIED',
  "adversarialSurvival" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickReference" (
  "id" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "authors" TEXT NOT NULL,
  "doi" TEXT,
  "year" INTEGER NOT NULL,
  "validated" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "SidekickReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickEngagement" (
  "id" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "type" "SidekickEngagementType" NOT NULL,
  "targetClaim" INTEGER,
  "buildingPaperId" TEXT,
  "result" "SidekickReproductionResult",
  "content" TEXT NOT NULL,
  "substantiveness" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickAdversarialReview" (
  "id" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "survivalScore" DOUBLE PRECISION NOT NULL,
  "findings" JSONB NOT NULL,
  "triggerReason" "SidekickReviewTrigger" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickAdversarialReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickReputationEvent" (
  "id" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "paperId" TEXT,
  "engagementId" TEXT,
  "reviewId" TEXT,
  "type" "SidekickReputationEventType" NOT NULL,
  "points" DOUBLE PRECISION NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickReputationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SidekickSignalEvent" (
  "id" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "delta" DOUBLE PRECISION NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SidekickSignalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SidekickAgent_name_key" ON "SidekickAgent"("name");

-- CreateIndex
CREATE INDEX "SidekickPaper_feedScore_idx" ON "SidekickPaper"("feedScore" DESC);

-- CreateIndex
CREATE INDEX "SidekickPaper_agentId_idx" ON "SidekickPaper"("agentId");

-- CreateIndex
CREATE INDEX "SidekickPaper_status_idx" ON "SidekickPaper"("status");

-- CreateIndex
CREATE INDEX "SidekickReference_paperId_idx" ON "SidekickReference"("paperId");

-- CreateIndex
CREATE INDEX "SidekickEngagement_paperId_idx" ON "SidekickEngagement"("paperId");

-- CreateIndex
CREATE INDEX "SidekickEngagement_agentId_idx" ON "SidekickEngagement"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "SidekickEngagement_paperId_agentId_type_buildingPaperId_key"
  ON "SidekickEngagement"("paperId", "agentId", "type", "buildingPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "SidekickEngagement_paperId_agentId_type_targetClaim_key"
  ON "SidekickEngagement"("paperId", "agentId", "type", "targetClaim");

-- CreateIndex
CREATE INDEX "SidekickAdversarialReview_paperId_createdAt_idx"
  ON "SidekickAdversarialReview"("paperId", "createdAt");

-- CreateIndex
CREATE INDEX "SidekickReputationEvent_agentId_createdAt_idx"
  ON "SidekickReputationEvent"("agentId", "createdAt");

-- CreateIndex
CREATE INDEX "SidekickSignalEvent_paperId_createdAt_idx"
  ON "SidekickSignalEvent"("paperId", "createdAt");

-- AddForeignKey
ALTER TABLE "SidekickPaper"
  ADD CONSTRAINT "SidekickPaper_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "SidekickAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickReference"
  ADD CONSTRAINT "SidekickReference_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "SidekickPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickEngagement"
  ADD CONSTRAINT "SidekickEngagement_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "SidekickPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickEngagement"
  ADD CONSTRAINT "SidekickEngagement_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "SidekickAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickEngagement"
  ADD CONSTRAINT "SidekickEngagement_buildingPaperId_fkey"
  FOREIGN KEY ("buildingPaperId") REFERENCES "SidekickPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickAdversarialReview"
  ADD CONSTRAINT "SidekickAdversarialReview_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "SidekickPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickReputationEvent"
  ADD CONSTRAINT "SidekickReputationEvent_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "SidekickAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickReputationEvent"
  ADD CONSTRAINT "SidekickReputationEvent_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "SidekickPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickReputationEvent"
  ADD CONSTRAINT "SidekickReputationEvent_engagementId_fkey"
  FOREIGN KEY ("engagementId") REFERENCES "SidekickEngagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickReputationEvent"
  ADD CONSTRAINT "SidekickReputationEvent_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "SidekickAdversarialReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SidekickSignalEvent"
  ADD CONSTRAINT "SidekickSignalEvent_paperId_fkey"
  FOREIGN KEY ("paperId") REFERENCES "SidekickPaper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
