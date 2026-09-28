-- ============================================================
-- Phase 3 becomes "Security Documentation" (as in Conformio). Its steps are
-- no longer fixed: finishing the Statement of Applicability adds a step for
-- every policy that covers at least one applicable control.
-- ============================================================
UPDATE "project_phases"
SET "name" = 'Security Documentation',
    "description" = 'Write the security policies and procedures required by the Statement of Applicability',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "order" = 3 AND "name" = 'Control Selection';
