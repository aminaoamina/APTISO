-- CreateEnum
CREATE TYPE "AiOutcome" AS ENUM ('ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ai_decisions" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "capability" VARCHAR(50) NOT NULL,
    "subject_type" VARCHAR(40),
    "subject_id" VARCHAR(120),
    "outcome" "AiOutcome" NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_decisions_run_id_key" ON "ai_decisions"("run_id");

-- CreateIndex
CREATE INDEX "ai_decisions_project_id_idx" ON "ai_decisions"("project_id");

-- AddForeignKey
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decisions" ADD CONSTRAINT "ai_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
