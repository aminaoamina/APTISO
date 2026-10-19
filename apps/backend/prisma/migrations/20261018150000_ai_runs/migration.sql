-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "user_id" UUID,
    "capability" VARCHAR(50) NOT NULL,
    "model" VARCHAR(120),
    "prompt_version" VARCHAR(60) NOT NULL,
    "input_hash" CHAR(64) NOT NULL,
    "subject_type" VARCHAR(40),
    "subject_id" UUID,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "validation" JSONB,
    "output" JSONB,
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(6),

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_runs_project_id_capability_idx" ON "ai_runs"("project_id", "capability");

-- CreateIndex
CREATE INDEX "ai_runs_subject_type_subject_id_idx" ON "ai_runs"("subject_type", "subject_id");

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
