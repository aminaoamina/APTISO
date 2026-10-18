-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('WORK_ON_DOCUMENT', 'REVIEW_DOCUMENT', 'APPROVE_DOCUMENT', 'AWARENESS_TASK', 'TRAINING_TASK', 'HR_REQUEST', 'FINANCE_REQUEST', 'TECHNOLOGY_REQUEST');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "AuditAction" ADD VALUE 'TASK_COMPLETED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TASK_ASSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_COMPLETED';

-- AlterTable
ALTER TABLE "document_instances" ADD COLUMN     "approver_id" UUID,
ADD COLUMN     "deadline" TIMESTAMP(6),
ADD COLUMN     "owner_id" UUID,
ADD COLUMN     "reviewer_id" UUID,
ADD COLUMN     "update_interval" INTEGER;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "project_id" UUID,
ADD COLUMN     "task_assignment_id" UUID;

-- AlterTable
ALTER TABLE "project_steps" ADD COLUMN     "completion_data" JSONB,
ADD COLUMN     "metadata_json" JSONB;

-- CreateTable
CREATE TABLE "task_assignments" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "step_id" UUID,
    "document_instance_id" UUID,
    "assigned_to" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "deadline" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),
    "notes" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignments_assigned_to_status_idx" ON "task_assignments"("assigned_to", "status");

-- CreateIndex
CREATE INDEX "task_assignments_project_id_idx" ON "task_assignments"("project_id");

-- CreateIndex
CREATE INDEX "task_assignments_step_id_idx" ON "task_assignments"("step_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_task_assignment_id_fkey" FOREIGN KEY ("task_assignment_id") REFERENCES "task_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "document_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
