-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('CONTRACTUAL', 'LEGAL_REGULATORY', 'OTHER');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('NON_COMPLIANT', 'COMPLIANT');

-- CreateTable
CREATE TABLE "requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "step_id" UUID NOT NULL,
    "requirement_type" "RequirementType" NOT NULL,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'NON_COMPLIANT',
    "interested_party" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "responsible_person_id" UUID NOT NULL,
    "related_area" VARCHAR(500),
    "deadline" TIMESTAMP(6),
    "document_stipulating" TEXT,
    "date_of_document" TIMESTAMP(6),
    "valid_from" TIMESTAMP(6),
    "country" VARCHAR(200),
    "state" VARCHAR(200),
    "link" TEXT,
    "law_regulation_name" VARCHAR(500),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "requirements_step_id_idx" ON "requirements"("step_id");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_responsible_person_id_fkey" FOREIGN KEY ("responsible_person_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill step 5 into existing projects
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p1s5.legal-requirements',
  'Register of Legal, Contractual, and Other Requirements',
  'List all relevant interested parties and define what they expect from your security — this way you will know how to configure further documents and activities.',
  'REGISTER',
  5,
  'NOT_STARTED',
  '{"clause": "Clause 4.2 and control A.5.31", "workload_hours": 6, "estimated_days": 4, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Project Preparation'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p1s5.legal-requirements'
  );
