-- CreateTable
CREATE TABLE "DatasetEntry" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourcePaperId" TEXT,
    "sourceRank" DOUBLE PRECISION,
    "addedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DatasetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DatasetEntry_domain_idx" ON "DatasetEntry"("domain");

-- CreateIndex
CREATE INDEX "DatasetEntry_sourceRank_idx" ON "DatasetEntry"("sourceRank" DESC);
