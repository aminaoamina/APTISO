-- The status type now serves every long AI task (reviews, evidence analyses).
ALTER TYPE "AiReviewStatus" RENAME TO "AiJobStatus";
