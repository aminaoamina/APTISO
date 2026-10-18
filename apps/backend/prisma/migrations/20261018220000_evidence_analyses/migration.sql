-- CreateTable
CREATE TABLE "evidence_analyses" (
    "id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "job_id" UUID,
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "summary" TEXT,
    "document_type" VARCHAR(200),
    "suggestions" JSONB,
    "expiry_date" DATE,
    "expiry_quote" TEXT,
    "pages" INTEGER,
    "ocr_pages" INTEGER,
    "note" VARCHAR(500),
    "error" TEXT,
    "run_id" UUID,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "evidence_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_analyses_file_id_key" ON "evidence_analyses"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_analyses_job_id_key" ON "evidence_analyses"("job_id");

-- AddForeignKey
ALTER TABLE "evidence_analyses" ADD CONSTRAINT "evidence_analyses_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "evidence_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;
