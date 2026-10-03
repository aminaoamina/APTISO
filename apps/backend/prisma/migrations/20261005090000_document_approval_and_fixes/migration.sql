-- Document approval before the library (clause 7.5.2 c).
ALTER TABLE "document_instances" ADD COLUMN "review_requested_by" UUID, ADD COLUMN "review_notes" VARCHAR(500);
ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_review_requested_by_fkey"
  FOREIGN KEY ("review_requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD COLUMN "approved_by" UUID;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- Earlier versions were published without a separate approval: the publisher approved them.
UPDATE "document_versions" SET "approved_by" = "published_by";

-- APPROVED was never used: approval publishes the document.
UPDATE "document_instances" SET "status" = 'DRAFT' WHERE "status" = 'APPROVED';
ALTER TYPE "DocumentStatus" RENAME TO "DocumentStatus_old";
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED');
ALTER TABLE "document_instances" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "document_instances" ALTER COLUMN "status" TYPE "DocumentStatus" USING ("status"::text::"DocumentStatus");
ALTER TABLE "document_instances" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "DocumentStatus_old";

-- Step 8 (awareness) refers to clause 7.3 and control A.6.3 of ISO/IEC 27001:2022.
UPDATE "project_steps" SET "metadata_json" = jsonb_set(COALESCE("metadata_json", '{}'::jsonb), '{clause}', '"Clause 7.3 and control A.6.3"')
WHERE "key" = 'iso27001.p1s8.security-awareness';
