-- Evidence: files, links and notes proving that requirements are met (clauses 7.5.3 and 9.1).
-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('FILE', 'LINK', 'NOTE');

-- CreateEnum
CREATE TYPE "EvidenceTargetType" AS ENUM ('CLAUSE', 'SOA_CONTROL', 'TASK');

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "url" VARCHAR(1000),
    "collected_on" DATE NOT NULL,
    "valid_until" DATE,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),
    "deleted_by" UUID,
    "delete_reason" VARCHAR(500),

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_files" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "uploaded_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" UUID NOT NULL,
    "evidence_id" UUID NOT NULL,
    "target_type" "EvidenceTargetType" NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "evidence_project_id_deleted_at_idx" ON "evidence"("project_id", "deleted_at");

-- CreateIndex
CREATE INDEX "evidence_files_evidence_id_idx" ON "evidence_files"("evidence_id");

-- CreateIndex
CREATE INDEX "evidence_links_target_type_target_id_idx" ON "evidence_links"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_links_evidence_id_target_type_target_id_key" ON "evidence_links"("evidence_id", "target_type", "target_id");

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "compliance_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

