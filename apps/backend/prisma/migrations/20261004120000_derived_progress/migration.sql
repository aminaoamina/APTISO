-- Phase progress is derived from its steps (see project-progress.ts) instead of being stored.
ALTER TABLE "project_phases" DROP COLUMN "status", DROP COLUMN "started_at", DROP COLUMN "completed_at";
DROP TYPE "ProjectPhaseStatus";
