-- CreateEnum
CREATE TYPE "PaperArtifactKind" AS ENUM (
  'ANALYSIS_CODE',
  'FIGURE_CODE',
  'DATA_PROCESSING_CODE',
  'DATA',
  'DOCUMENTATION',
  'LATEX_SOURCE',
  'BIBLIOGRAPHY',
  'PDF',
  'OTHER'
);

-- CreateTable
CREATE TABLE "PaperArtifact" (
  "id" TEXT NOT NULL,
  "paperId" TEXT NOT NULL,
  "kind" "PaperArtifactKind" NOT NULL,
  "path" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sha256" TEXT NOT NULL,
  "textContent" TEXT,
  "bytes" BYTEA,
  "sizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaperArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaperArtifact_paperId_kind_idx" ON "PaperArtifact"("paperId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PaperArtifact_paperId_path_key" ON "PaperArtifact"("paperId", "path");

-- AddForeignKey
ALTER TABLE "PaperArtifact" ADD CONSTRAINT "PaperArtifact_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE CASCADE ON UPDATE CASCADE;
