-- CreateTable
CREATE TABLE "audit_programs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "objectives" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "methods" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "audit_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_audits" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "planned_month" DATE NOT NULL,
    "auditor_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "internal_audit_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "program_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_programs_project_id_key" ON "audit_programs"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "program_audits_internal_audit_id_key" ON "program_audits"("internal_audit_id");

-- CreateIndex
CREATE INDEX "program_audits_program_id_idx" ON "program_audits"("program_id");

-- AddForeignKey
ALTER TABLE "audit_programs" ADD CONSTRAINT "audit_programs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_audits" ADD CONSTRAINT "program_audits_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "audit_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_audits" ADD CONSTRAINT "program_audits_internal_audit_id_fkey" FOREIGN KEY ("internal_audit_id") REFERENCES "internal_audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

