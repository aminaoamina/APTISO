-- ============================================================
-- Phase 4: Preparation for External Audit (clauses 6.2, 7.2, 9.1, 9.2, 9.3, 10)
-- Registers: nonconformities + corrective actions, incidents, trainings,
-- security objectives, internal audits, management review setup and reviews.
-- ============================================================

-- CreateEnum
CREATE TYPE "NonconformityStatus" AS ENUM ('UNASSIGNED', 'ASSIGNED', 'ACTIONS_DEFINED', 'RESOLVED', 'NOT_RELEVANT');

-- CreateEnum
CREATE TYPE "FindingSource" AS ENUM ('INTERNAL_AUDIT', 'EXTERNAL_AUDIT', 'INCIDENT', 'MANAGEMENT_REVIEW', 'EMPLOYEE', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('REPORTED', 'ASSESSED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('PROPOSED', 'APPROVED', 'SCHEDULED', 'PERFORMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ObjectiveType" AS ENUM ('TOP_LEVEL', 'OPERATIONAL');

-- CreateEnum
CREATE TYPE "ReviewFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'REPORTED', 'APPROVED');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('CONFORMING', 'MINOR_NONCONFORMITY', 'MAJOR_NONCONFORMITY', 'OBSERVATION', 'NOT_AUDITED');

-- CreateEnum
CREATE TYPE "ManagementReviewStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewDecisionType" AS ENUM ('IMPROVEMENT', 'ISMS_CHANGE', 'RESOURCES', 'OTHER');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'CORRECTIVE_ACTION';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'INTERNAL_AUDIT';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'MANAGEMENT_REVIEW_ACTION';

-- CreateTable
CREATE TABLE "nonconformities" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "source" "FindingSource" NOT NULL DEFAULT 'OTHER',
    "detected_on" TIMESTAMP(6) NOT NULL,
    "reported_by" UUID NOT NULL,
    "responsible_id" UUID,
    "status" "NonconformityStatus" NOT NULL DEFAULT 'UNASSIGNED',
    "correction" TEXT,
    "root_cause" TEXT,
    "effectiveness_review" TEXT,
    "effectiveness_verified_by" UUID,
    "effectiveness_verified_at" TIMESTAMP(6),
    "not_relevant_reason" TEXT,
    "closed_at" TIMESTAMP(6),
    "audit_item_id" UUID,
    "incident_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "nonconformities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_actions" (
    "id" UUID NOT NULL,
    "nonconformity_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "responsible_id" UUID NOT NULL,
    "due_date" TIMESTAMP(6),
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "completed_at" TIMESTAMP(6),
    "task_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(6) NOT NULL,
    "reported_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reported_by" UUID NOT NULL,
    "responsible_id" UUID,
    "affects_confidentiality" BOOLEAN NOT NULL DEFAULT false,
    "affects_integrity" BOOLEAN NOT NULL DEFAULT false,
    "affects_availability" BOOLEAN NOT NULL DEFAULT false,
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'LOW',
    "status" "IncidentStatus" NOT NULL DEFAULT 'REPORTED',
    "is_security_incident" BOOLEAN,
    "assessment" TEXT,
    "response" TEXT,
    "lessons_learned" TEXT,
    "evidence" TEXT,
    "closed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trainings" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "skills" TEXT NOT NULL,
    "method" VARCHAR(200),
    "provider" VARCHAR(200),
    "planned_date" TIMESTAMP(6),
    "performed_date" TIMESTAMP(6),
    "status" "TrainingStatus" NOT NULL DEFAULT 'PROPOSED',
    "participant_ids" JSONB NOT NULL,
    "evidence" TEXT,
    "effectiveness" TEXT,
    "source_step_id" UUID,
    "source_key" VARCHAR(200),
    "approved_by" UUID,
    "approved_at" TIMESTAMP(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "trainings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_objectives" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ObjectiveType" NOT NULL DEFAULT 'TOP_LEVEL',
    "action_plan" TEXT,
    "resources" TEXT,
    "responsible_id" UUID,
    "due_date" TIMESTAMP(6),
    "measurement" TEXT,
    "frequency" "ReviewFrequency" NOT NULL DEFAULT 'YEARLY',
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" UUID,
    "approved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "security_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objective_measurements" (
    "id" UUID NOT NULL,
    "objective_id" UUID NOT NULL,
    "measured_on" TIMESTAMP(6) NOT NULL,
    "result" TEXT NOT NULL,
    "achieved" BOOLEAN NOT NULL,
    "comment" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "objective_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_audits" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "scope" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "start_date" TIMESTAMP(6) NOT NULL,
    "end_date" TIMESTAMP(6) NOT NULL,
    "lead_auditor_id" UUID NOT NULL,
    "auditees" TEXT,
    "status" "AuditStatus" NOT NULL DEFAULT 'PLANNED',
    "conclusion" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(6),
    "task_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "internal_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_checklist_items" (
    "id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "ref" VARCHAR(20) NOT NULL,
    "requirement" VARCHAR(300) NOT NULL,
    "question" TEXT NOT NULL,
    "result" "AuditResult",
    "evidence" TEXT,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "audit_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_review_setups" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "frequency" "ReviewFrequency" NOT NULL DEFAULT 'YEARLY',
    "next_review_date" TIMESTAMP(6),
    "reviewer_ids" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "configured_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "management_review_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_reviews" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "review_date" TIMESTAMP(6) NOT NULL,
    "participant_ids" JSONB NOT NULL,
    "status" "ManagementReviewStatus" NOT NULL DEFAULT 'PLANNED',
    "conclusions" TEXT,
    "completed_at" TIMESTAMP(6),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "management_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_review_inputs" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "item_key" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "summary" TEXT NOT NULL,
    "notes" TEXT,
    "discussed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "management_review_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_review_decisions" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "type" "ReviewDecisionType" NOT NULL DEFAULT 'IMPROVEMENT',
    "description" TEXT NOT NULL,
    "responsible_id" UUID,
    "due_date" TIMESTAMP(6),
    "status" "ActionStatus" NOT NULL DEFAULT 'PLANNED',
    "task_id" UUID,
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "management_review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nonconformities_audit_item_id_key" ON "nonconformities"("audit_item_id");

-- CreateIndex
CREATE INDEX "nonconformities_project_id_status_idx" ON "nonconformities"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "nonconformities_project_id_number_key" ON "nonconformities"("project_id", "number");

-- CreateIndex
CREATE INDEX "corrective_actions_nonconformity_id_idx" ON "corrective_actions"("nonconformity_id");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_project_id_number_key" ON "incidents"("project_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "trainings_project_id_source_key_key" ON "trainings"("project_id", "source_key");

-- CreateIndex
CREATE INDEX "security_objectives_project_id_idx" ON "security_objectives"("project_id");

-- CreateIndex
CREATE INDEX "objective_measurements_objective_id_idx" ON "objective_measurements"("objective_id");

-- CreateIndex
CREATE INDEX "internal_audits_project_id_idx" ON "internal_audits"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_checklist_items_audit_id_ref_key" ON "audit_checklist_items"("audit_id", "ref");

-- CreateIndex
CREATE UNIQUE INDEX "management_review_setups_project_id_key" ON "management_review_setups"("project_id");

-- CreateIndex
CREATE INDEX "management_reviews_project_id_idx" ON "management_reviews"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "management_review_inputs_review_id_item_key_key" ON "management_review_inputs"("review_id", "item_key");

-- CreateIndex
CREATE INDEX "management_review_decisions_review_id_idx" ON "management_review_decisions"("review_id");

-- AddForeignKey
ALTER TABLE "nonconformities" ADD CONSTRAINT "nonconformities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformities" ADD CONSTRAINT "nonconformities_audit_item_id_fkey" FOREIGN KEY ("audit_item_id") REFERENCES "audit_checklist_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nonconformities" ADD CONSTRAINT "nonconformities_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_actions" ADD CONSTRAINT "corrective_actions_nonconformity_id_fkey" FOREIGN KEY ("nonconformity_id") REFERENCES "nonconformities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trainings" ADD CONSTRAINT "trainings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_objectives" ADD CONSTRAINT "security_objectives_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objective_measurements" ADD CONSTRAINT "objective_measurements_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "security_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_audits" ADD CONSTRAINT "internal_audits_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_checklist_items" ADD CONSTRAINT "audit_checklist_items_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "internal_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_review_setups" ADD CONSTRAINT "management_review_setups_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_reviews" ADD CONSTRAINT "management_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_review_inputs" ADD CONSTRAINT "management_review_inputs_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_review_decisions" ADD CONSTRAINT "management_review_decisions_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "management_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ============================================================
-- Conformio's 5 phases. APTISO's phases 4-7 were empty placeholders:
--   2 Risk Assessment        -> Risk Management
--   4 Implementation         -> Preparation for External Audit
--   5 Internal Audit         -> ISMS Maintenance & Certification Cycle
--   6 Management Review      -> removed (now steps of phase 4)
--   7 Certification Readiness-> removed (planned as a separate feature)
-- ============================================================
UPDATE "project_phases" SET "name" = 'Risk Management',
  "description" = 'Assess information security risks, decide how to treat them and which controls apply',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "order" = 2;

UPDATE "project_phases" SET "name" = 'Preparation for External Audit',
  "description" = 'Run the ISMS and produce the evidence the certification auditor will check: trainings, objectives, internal audit and management review',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "order" = 4;

UPDATE "project_phases" SET "name" = 'ISMS Maintenance & Certification Cycle',
  "description" = 'Keep the ISMS running after certification: recurring reviews, audits and certification dates',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "order" = 5;

DELETE FROM "project_phases" p
WHERE p."order" IN (6, 7)
  AND NOT EXISTS (SELECT 1 FROM "project_steps" s WHERE s."phase_id" = p."id");

-- ============================================================
-- Phase 4 steps for existing projects
-- ============================================================
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT gen_random_uuid(), p.id, v.key, v.title, v.purpose, v.type::"StepType", v.ord, 'NOT_STARTED', v.meta::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "project_phases" p
CROSS JOIN (VALUES
  ('iso27001.p4s1.nonconformity-procedure', 'Procedure for Nonconformities and Corrective Actions',
   'Describe all activities related to corrective actions and the use of the Nonconformity and Corrective Action registers.',
   'DOCUMENT', 1,
   '{"clause": "Clauses 10.1 and 10.2", "workload_hours": 1.5, "estimated_days": 1, "mandatory": false, "policy_key": "nonconformity-procedure", "why": "This document is not mandatory, so if you do not see a benefit in using it, you can skip it."}'),
  ('iso27001.p4s2.internal-audit-procedure', 'Internal Audit Procedure',
   'Describe all audit related activities: writing the audit programme, selecting an auditor, conducting individual audits and reporting.',
   'DOCUMENT', 2,
   '{"clause": "Clause 9.2", "workload_hours": 1.5, "estimated_days": 1, "mandatory": false, "policy_key": "internal-audit-procedure", "why": "This document is not mandatory, so if you do not see a benefit in using it, you can skip it."}'),
  ('iso27001.p4s3.training-plan', 'Initial Training Plan',
   'Define which people will need to attend which security trainings, and keep the record of trainings performed.',
   'REGISTER', 3,
   '{"clause": "Clause 7.2 and control A.6.3", "workload_hours": 0.5, "estimated_days": 1, "mandatory": true}'),
  ('iso27001.p4s4.security-objectives', 'Setting Up Security Objectives',
   'Set up the information security objectives, who is responsible for them and how they are measured.',
   'REGISTER', 4,
   '{"clause": "Clauses 6.2 and 9.1", "workload_hours": 1.5, "estimated_days": 1, "mandatory": true}'),
  ('iso27001.p4s5.management-review-setup', 'Setting Up Management Review',
   'Set up how top management controls what is being done with security: what is reviewed, by whom and how often.',
   'REGISTER', 5,
   '{"clause": "Clauses 5.1, 5.3, and 9.3", "workload_hours": 0.5, "estimated_days": 1, "mandatory": true}'),
  ('iso27001.p4s6.internal-audit', 'Internal Audit',
   'Plan and perform the internal audit using a checklist of the ISO 27001 requirements and your applicable controls, and report the results.',
   'REGISTER', 6,
   '{"clause": "Clauses 9.2 and 10.1", "workload_hours": 9, "estimated_days": 1, "mandatory": true}'),
  ('iso27001.p4s7.management-review', 'First Official Management Review',
   'Provide top management with crucial information about security, and ask them for key decisions.',
   'REGISTER', 7,
   '{"clause": "Clauses 5.1, 9.3, 10.1, and 10.2", "workload_hours": 1, "estimated_days": 1, "mandatory": true}')
) AS v(key, title, purpose, type, ord, meta)
WHERE p."order" = 4
  AND NOT EXISTS (SELECT 1 FROM "project_steps" s WHERE s."phase_id" = p."id" AND s."key" = v.key);
