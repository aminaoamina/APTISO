-- Resource requests (clause 7.1) become their own records, decided by top management, instead of tasks.
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'REQUEST_DECIDED';

CREATE TYPE "ResourceRequestKind" AS ENUM ('HR', 'FINANCE', 'TECHNOLOGY');
CREATE TYPE "ResourceRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "resource_requests" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "kind" "ResourceRequestKind" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ResourceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" UUID NOT NULL,
    "decided_by" UUID,
    "decided_at" TIMESTAMP(6),
    "decision_comment" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "resource_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_requests_project_id_status_idx" ON "resource_requests"("project_id", "status");
CREATE INDEX "resource_requests_step_id_idx" ON "resource_requests"("step_id");
ALTER TABLE "resource_requests" ADD CONSTRAINT "resource_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_requests" ADD CONSTRAINT "resource_requests_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_requests" ADD CONSTRAINT "resource_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_requests" ADD CONSTRAINT "resource_requests_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notifications" ADD COLUMN "resource_request_id" UUID;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_resource_request_id_fkey" FOREIGN KEY ("resource_request_id") REFERENCES "resource_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Requests already sent as tasks (one task per recipient) become one request each.
-- The task notes read: '<label> requested for "<step>":\n<description>'.
INSERT INTO "resource_requests" ("id", "project_id", "step_id", "kind", "description", "status", "requested_by", "decided_by", "decided_at", "decision_comment", "created_at", "updated_at")
SELECT gen_random_uuid(), t."project_id", t."step_id",
       (CASE t."type"::text WHEN 'HR_REQUEST' THEN 'HR' WHEN 'FINANCE_REQUEST' THEN 'FINANCE' ELSE 'TECHNOLOGY' END)::"ResourceRequestKind",
       COALESCE(NULLIF(substring(t."notes" from position(E'\n' in t."notes") + 1), ''), t."notes", ''),
       (CASE t."status"::text WHEN 'COMPLETED' THEN 'APPROVED' WHEN 'CANCELLED' THEN 'REJECTED' ELSE 'PENDING' END)::"ResourceRequestStatus",
       t."assigned_by",
       CASE WHEN t."status"::text IN ('COMPLETED', 'CANCELLED') THEN t."assigned_to" END,
       t."completed_at", t."completion_notes", t."created_at", t."created_at"
FROM (
  SELECT DISTINCT ON (t."step_id", t."assigned_by", t."type", t."notes", date_trunc('second', t."created_at")) t.*
  FROM "task_assignments" t
  WHERE t."type"::text IN ('HR_REQUEST', 'FINANCE_REQUEST', 'TECHNOLOGY_REQUEST') AND t."step_id" IS NOT NULL
  ORDER BY t."step_id", t."assigned_by", t."type", t."notes", date_trunc('second', t."created_at"), t."completed_at" DESC NULLS LAST
) t;

DELETE FROM "task_assignments" WHERE "type"::text IN ('HR_REQUEST', 'FINANCE_REQUEST', 'TECHNOLOGY_REQUEST');

-- Tasks no longer carry requests.
ALTER TYPE "TaskType" RENAME TO "TaskType_old";
CREATE TYPE "TaskType" AS ENUM ('WORK_ON_DOCUMENT', 'REVIEW_DOCUMENT', 'APPROVE_DOCUMENT', 'AWARENESS_TASK', 'TRAINING_TASK', 'RISK_REVIEW', 'IMPLEMENT_CONTROL', 'CORRECTIVE_ACTION', 'INTERNAL_AUDIT', 'MANAGEMENT_REVIEW_ACTION', 'MANAGEMENT_REVIEW_DUE', 'OBJECTIVES_REVIEW', 'DOCUMENT_REVIEW', 'INCIDENTS_REVIEW', 'TRAININGS_REVIEW');
ALTER TABLE "task_assignments" ALTER COLUMN "type" TYPE "TaskType" USING ("type"::text::"TaskType");
DROP TYPE "TaskType_old";
