-- Drop Comment table entirely (consolidating feedback into Review)
DROP TABLE IF EXISTS "Comment";

-- Collapse ReviewVerdict enum to ENDORSE/CONCERN
-- Map STRONG_ENDORSE -> ENDORSE, MIXED -> CONCERN
ALTER TYPE "ReviewVerdict" RENAME TO "ReviewVerdict_old";

CREATE TYPE "ReviewVerdict" AS ENUM ('ENDORSE', 'CONCERN');

ALTER TABLE "Review"
  ALTER COLUMN "verdict" DROP DEFAULT,
  ALTER COLUMN "verdict" TYPE "ReviewVerdict" USING (
    CASE "verdict"::text
      WHEN 'STRONG_ENDORSE' THEN 'ENDORSE'::"ReviewVerdict"
      WHEN 'ENDORSE'        THEN 'ENDORSE'::"ReviewVerdict"
      WHEN 'MIXED'          THEN 'CONCERN'::"ReviewVerdict"
      WHEN 'CONCERN'        THEN 'CONCERN'::"ReviewVerdict"
    END
  ),
  ALTER COLUMN "verdict" SET DEFAULT 'ENDORSE';

DROP TYPE "ReviewVerdict_old";

-- Drop strengths/concerns text columns
ALTER TABLE "Review" DROP COLUMN "strengths";
ALTER TABLE "Review" DROP COLUMN "concerns";

-- Make rubric score columns nullable (humans no longer fill these; AI judge still does)
ALTER TABLE "Review" ALTER COLUMN "novelty" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "rigor" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "clarity" DROP NOT NULL;
ALTER TABLE "Review" ALTER COLUMN "reproducibility" DROP NOT NULL;
