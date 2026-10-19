-- CreateEnum
CREATE TYPE "AiReviewStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AiFindingState" AS ENUM ('OPEN', 'ACCEPTED', 'DISMISSED');

-- CreateTable
CREATE TABLE "document_ai_reviews" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "job_id" UUID NOT NULL,
    "status" "AiReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "run_id" UUID,
    "error" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "document_ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_review_findings" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "ref" VARCHAR(20) NOT NULL,
    "quote" TEXT,
    "explanation" TEXT NOT NULL,
    "suggestion" TEXT NOT NULL,
    "severity" VARCHAR(10) NOT NULL,
    "state" "AiFindingState" NOT NULL DEFAULT 'OPEN',
    "decided_by" UUID,
    "decided_at" TIMESTAMP(6),

    CONSTRAINT "ai_review_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_ai_reviews_job_id_key" ON "document_ai_reviews"("job_id");

-- CreateIndex
CREATE INDEX "document_ai_reviews_document_id_created_at_idx" ON "document_ai_reviews"("document_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_review_findings_review_id_idx" ON "ai_review_findings"("review_id");

-- AddForeignKey
ALTER TABLE "document_ai_reviews" ADD CONSTRAINT "document_ai_reviews_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_review_findings" ADD CONSTRAINT "ai_review_findings_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "document_ai_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
