-- ============================================================
-- Phase 5: ISMS Maintenance & Certification Cycle
-- Certification dates, recurring review frequencies, and the activity key
-- that keeps recurring maintenance tasks idempotent (one open task per activity).
-- ============================================================

-- AlterEnum


ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'MANAGEMENT_REVIEW_DUE';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'OBJECTIVES_REVIEW';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'DOCUMENT_REVIEW';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'INCIDENTS_REVIEW';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'TRAININGS_REVIEW';

-- AlterTable
ALTER TABLE "task_assignments" ADD COLUMN     "activity_key" VARCHAR(100);

-- CreateTable
CREATE TABLE "maintenance_setups" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "certification_date" TIMESTAMP(6),
    "certification_body" VARCHAR(200),
    "certificate_number" VARCHAR(100),
    "incident_review_frequency" "ReviewFrequency" NOT NULL DEFAULT 'QUARTERLY',
    "training_review_frequency" "ReviewFrequency" NOT NULL DEFAULT 'YEARLY',
    "last_run_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "maintenance_setups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_setups_project_id_key" ON "maintenance_setups"("project_id");

-- CreateIndex
CREATE INDEX "task_assignments_project_id_type_activity_key_idx" ON "task_assignments"("project_id", "type", "activity_key");

-- AddForeignKey
ALTER TABLE "maintenance_setups" ADD CONSTRAINT "maintenance_setups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Phase 5 step (the maintenance module) for existing projects
-- ============================================================
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p5s1.maintenance',
  'ISMS Maintenance & Certification Cycle',
  'Keep the ISMS running after certification: track the certification cycle and perform the recurring reviews, audits and management reviews on time.',
  'REGISTER',
  1,
  'NOT_STARTED',
  '{"clause": "Clauses 9.1, 9.2, 9.3 and 10.1", "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."order" = 5
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p5s1.maintenance'
  );
