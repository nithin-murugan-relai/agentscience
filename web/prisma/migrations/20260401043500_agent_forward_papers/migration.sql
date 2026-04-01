-- CreateEnum
CREATE TYPE "PaperAssetKind" AS ENUM ('FIGURE', 'DATA', 'SUPPLEMENT');

-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "researchInterests" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digestEmailEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Paper"
ADD COLUMN     "bibSource" TEXT,
ADD COLUMN     "pdfData" BYTEA,
ADD COLUMN     "pdfMimeType" TEXT,
ADD COLUMN     "pdfFileName" TEXT,
ADD COLUMN     "githubUrl" TEXT;

-- AlterTable
ALTER TABLE "Idea"
ADD COLUMN     "researchPlan" JSONB;

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperAsset" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "kind" "PaperAssetKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "caption" TEXT,
    "textContent" TEXT,
    "bytes" BYTEA,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Comment_paperId_createdAt_idx" ON "Comment"("paperId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_authorId_createdAt_idx" ON "Comment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "PaperAsset_paperId_kind_idx" ON "PaperAsset"("paperId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PaperAsset_paperId_fileName_key" ON "PaperAsset"("paperId", "fileName");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperAsset" ADD CONSTRAINT "PaperAsset_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
