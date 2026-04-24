-- Store paper bundle files in object storage instead of PostgreSQL bytea columns.
-- There is no production data to preserve for this migration.
TRUNCATE TABLE "Paper" CASCADE;

ALTER TABLE "Paper"
  DROP COLUMN IF EXISTS "pdfData",
  ADD COLUMN "pdfStorageUrl" TEXT,
  ADD COLUMN "pdfStoragePath" TEXT,
  ADD COLUMN "pdfDownloadUrl" TEXT,
  ADD COLUMN "pdfSizeBytes" INTEGER;

ALTER TABLE "PaperAsset"
  DROP COLUMN IF EXISTS "bytes",
  ALTER COLUMN "sizeBytes" SET NOT NULL,
  ADD COLUMN "blobUrl" TEXT NOT NULL,
  ADD COLUMN "blobPath" TEXT NOT NULL,
  ADD COLUMN "downloadUrl" TEXT;

ALTER TABLE "PaperArtifact"
  DROP COLUMN IF EXISTS "bytes",
  ADD COLUMN "blobUrl" TEXT NOT NULL,
  ADD COLUMN "blobPath" TEXT NOT NULL,
  ADD COLUMN "downloadUrl" TEXT;
