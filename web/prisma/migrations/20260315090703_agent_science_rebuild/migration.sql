-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESEARCHER', 'LAB', 'BOT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaperOrigin" AS ENUM ('MANUAL', 'SIDEKICK', 'IMPORT');

-- CreateEnum
CREATE TYPE "PaperVisibility" AS ENUM ('PUBLIC', 'UNLISTED');

-- CreateEnum
CREATE TYPE "ReviewKind" AS ENUM ('HUMAN', 'AI');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('STRONG_ENDORSE', 'ENDORSE', 'MIXED', 'CONCERN');

-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('PENDING', 'READY', 'DISABLED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "bio" TEXT,
    "institution" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RESEARCHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "latexSource" TEXT,
    "pdfUrl" TEXT,
    "canonicalUrl" TEXT,
    "doi" TEXT,
    "externalId" TEXT,
    "origin" "PaperOrigin" NOT NULL DEFAULT 'MANUAL',
    "visibility" "PaperVisibility" NOT NULL DEFAULT 'PUBLIC',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceNoteIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAuthor" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "affiliation" TEXT,
    "isCorresponding" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PaperAuthor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "authorId" TEXT NOT NULL,
    "paperId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerName" TEXT,
    "kind" "ReviewKind" NOT NULL DEFAULT 'HUMAN',
    "verdict" "ReviewVerdict" NOT NULL DEFAULT 'ENDORSE',
    "summary" TEXT NOT NULL,
    "strengths" TEXT,
    "concerns" TEXT,
    "novelty" INTEGER NOT NULL,
    "rigor" INTEGER NOT NULL,
    "clarity" INTEGER NOT NULL,
    "reproducibility" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPaper" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperReference" (
    "id" TEXT NOT NULL,
    "sourcePaperId" TEXT NOT NULL,
    "targetPaperId" TEXT,
    "referenceTitle" TEXT,
    "referenceDoi" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "kind" TEXT NOT NULL DEFAULT 'citation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperMetric" (
    "paperId" TEXT NOT NULL,
    "humanScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "networkScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" DOUBLE PRECISION,
    "finalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiStatus" "MetricStatus" NOT NULL DEFAULT 'PENDING',
    "aiSummary" TEXT,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "ideaCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaperMetric_pkey" PRIMARY KEY ("paperId")
);

-- CreateTable
CREATE TABLE "IntegrationKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_slug_key" ON "Paper"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_doi_key" ON "Paper"("doi");

-- CreateIndex
CREATE UNIQUE INDEX "Paper_externalId_key" ON "Paper"("externalId");

-- CreateIndex
CREATE INDEX "Paper_publishedAt_idx" ON "Paper"("publishedAt");

-- CreateIndex
CREATE INDEX "Paper_origin_idx" ON "Paper"("origin");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAuthor_paperId_userId_key" ON "PaperAuthor"("paperId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAuthor_paperId_position_key" ON "PaperAuthor"("paperId", "position");

-- CreateIndex
CREATE INDEX "Idea_paperId_idx" ON "Idea"("paperId");

-- CreateIndex
CREATE INDEX "Review_paperId_kind_idx" ON "Review"("paperId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPaper_paperId_userId_key" ON "SavedPaper"("paperId", "userId");

-- CreateIndex
CREATE INDEX "PaperReference_sourcePaperId_idx" ON "PaperReference"("sourcePaperId");

-- CreateIndex
CREATE INDEX "PaperReference_targetPaperId_idx" ON "PaperReference"("targetPaperId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationKey_tokenHash_key" ON "IntegrationKey"("tokenHash");

-- CreateIndex
CREATE INDEX "IntegrationKey_userId_idx" ON "IntegrationKey"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAuthor" ADD CONSTRAINT "PaperAuthor_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAuthor" ADD CONSTRAINT "PaperAuthor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Idea" ADD CONSTRAINT "Idea_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPaper" ADD CONSTRAINT "SavedPaper_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedPaper" ADD CONSTRAINT "SavedPaper_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperReference" ADD CONSTRAINT "PaperReference_sourcePaperId_fkey" FOREIGN KEY ("sourcePaperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperReference" ADD CONSTRAINT "PaperReference_targetPaperId_fkey" FOREIGN KEY ("targetPaperId") REFERENCES "Paper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperMetric" ADD CONSTRAINT "PaperMetric_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationKey" ADD CONSTRAINT "IntegrationKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
