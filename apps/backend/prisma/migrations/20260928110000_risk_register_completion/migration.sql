-- ============================================================
-- Risk register, Part D (step completion)
--
-- 1. New task type for the yearly "Review of risks" required by the
--    Risk Assessment and Treatment Methodology (section 3.4). It is only
--    added here, not used, so it is safe inside the migration transaction.
-- 2. Conformio's workload for the Risk Register step: 4 h to fill out the
--    register + 2 h for review and approval, usually finished in 4 days.
-- ============================================================

ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'RISK_REVIEW';

UPDATE "project_steps"
SET "metadata_json" = jsonb_set(jsonb_set("metadata_json"::jsonb, '{workload_hours}', '6'), '{estimated_days}', '4'),
    "updated_at" = CURRENT_TIMESTAMP
WHERE "key" = 'iso27001.p2s2.risk-register'
  AND "metadata_json" IS NOT NULL;
