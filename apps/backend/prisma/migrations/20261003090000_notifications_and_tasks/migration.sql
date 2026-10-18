-- One notification service: every notification records who triggered it.
ALTER TYPE "NotificationType" ADD VALUE 'TASK_DUE_SOON';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_CANCELLED';

ALTER TABLE "notifications" ADD COLUMN "actor_id" UUID;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tasks module: cancellation, completion notes and deadline reminders.
ALTER TYPE "TaskStatus" ADD VALUE 'CANCELLED';

ALTER TABLE "task_assignments" ADD COLUMN "completion_notes" TEXT;
ALTER TABLE "task_assignments" ADD COLUMN "reminded_at" TIMESTAMP(6);

-- Existing task notifications get their actor: the assigner for assignments, the assignee for completions.
UPDATE "notifications" n SET "actor_id" = t."assigned_by"
FROM "task_assignments" t WHERE n."task_assignment_id" = t."id" AND n."type" = 'TASK_ASSIGNED';
UPDATE "notifications" n SET "actor_id" = t."assigned_to"
FROM "task_assignments" t WHERE n."task_assignment_id" = t."id" AND n."type" = 'TASK_COMPLETED';
UPDATE "notifications" n SET "actor_id" = r."requested_by"
FROM "organization_join_requests" r WHERE n."join_request_id" = r."id";
