-- ============================================================
-- Phase 2 / Step 3: Statement of Applicability + Risk Treatment Plan
-- (ISO/IEC 27001 clauses 6.1.3 d, 6.1.3 e, 6.1.3 f, 6.2 and 8.3)
--
-- soa_registers        setup questionnaire + Risk Treatment Plan confirmation
-- soa_controls         one row per Annex A control (applicability, justification,
--                      implementation method, status, treatment plan, resources)
-- soa_owner_approvals  risk owners' approval of the plan and residual risks
-- ============================================================

-- CreateEnum
CREATE TYPE "ControlImplementationStatus" AS ENUM ('IMPLEMENTED', 'UNDERWAY', 'PLANNED', 'REVIEW_NEEDED');

-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'IMPLEMENT_CONTROL';

-- CreateTable
CREATE TABLE "soa_registers" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "setup" JSONB,
    "setup_completed_at" TIMESTAMP(6),
    "rtp_confirmed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "soa_registers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soa_controls" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "applicable" BOOLEAN,
    "justification" TEXT,
    "implementation_method" TEXT,
    "status" "ControlImplementationStatus",
    "suggestion" JSONB,
    "is_user_edited" BOOLEAN NOT NULL DEFAULT false,
    "responsible_id" UUID,
    "deadline" TIMESTAMP(6),
    "resources" TEXT,
    "resources_decision" "RiskApprovalDecision",
    "resources_comment" TEXT,
    "resources_decided_by" UUID,
    "resources_decided_at" TIMESTAMP(6),
    "task_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "soa_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soa_owner_approvals" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "decision" "RiskApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "soa_owner_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "soa_registers_step_id_key" ON "soa_registers"("step_id");

-- CreateIndex
CREATE INDEX "soa_controls_step_id_idx" ON "soa_controls"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "soa_controls_step_id_control_id_key" ON "soa_controls"("step_id", "control_id");

-- CreateIndex
CREATE UNIQUE INDEX "soa_owner_approvals_step_id_user_id_key" ON "soa_owner_approvals"("step_id", "user_id");

-- AddForeignKey
ALTER TABLE "soa_registers" ADD CONSTRAINT "soa_registers_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_controls" ADD CONSTRAINT "soa_controls_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_controls" ADD CONSTRAINT "soa_controls_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "risk_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_controls" ADD CONSTRAINT "soa_controls_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_controls" ADD CONSTRAINT "soa_controls_resources_decided_by_fkey" FOREIGN KEY ("resources_decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_owner_approvals" ADD CONSTRAINT "soa_owner_approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_owner_approvals" ADD CONSTRAINT "soa_owner_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soa_owner_approvals" ADD CONSTRAINT "soa_owner_approvals_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- Output document template (no wizard questions)
-- ============================================================
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000009',
    'SOA',
    'Statement of Applicability and Risk Treatment Plan',
    '1.0',
    'Applicability, justification, implementation method and status of the ISO/IEC 27001:2022 Annex A controls, the Risk Treatment Plan and its approval by the risk owners (clauses 6.1.3 d, e, f and 8.3).',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- Backfill Phase 2 Step 3 into existing projects
-- ============================================================
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p2s3.statement-of-applicability',
  'Statement of Applicability',
  'List which controls are appropriate to be implemented, why, and how they are implemented, and plan the implementation of the controls that are not yet in place (Risk Treatment Plan).',
  'REGISTER',
  3,
  'NOT_STARTED',
  '{"clause": "Clauses 6.1.3 d), 6.1.3 e), 6.2, and 8.3", "workload_hours": 5, "estimated_days": 2, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Risk Assessment'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p2s3.statement-of-applicability'
  );
