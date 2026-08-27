-- ============================================================
-- Add clause info to existing steps + fix missing Step 3 metadata
-- ============================================================

-- Step 1 (intro): add clause
UPDATE "project_steps"
SET "metadata_json" = COALESCE("metadata_json", '{}'::jsonb) || '{"clause": "Not required by the standard"}'::jsonb
WHERE "key" = 'iso27001.p1s1.intro';

-- Step 2 (doc-control): add clause + workload/days if missing
UPDATE "project_steps"
SET "metadata_json" = COALESCE("metadata_json", '{}'::jsonb) || '{"clause": "Clause 7.5", "workload_hours": 1, "estimated_days": 2, "mandatory": false}'::jsonb
WHERE "key" = 'iso27001.p1s2.doc-control';

-- Step 3 (project-plan): add clause + ensure workload/days exist
UPDATE "project_steps"
SET "metadata_json" = COALESCE("metadata_json", '{}'::jsonb) || '{"clause": "Not required by the standard", "workload_hours": 4, "estimated_days": 2, "mandatory": false}'::jsonb
WHERE "key" = 'iso27001.p1s3.project-plan';

-- Step 4 (req-identification): clause already in migration, but ensure it's set
UPDATE "project_steps"
SET "metadata_json" = COALESCE("metadata_json", '{}'::jsonb) || '{"clause": "Clause 4.2 and control A.5.31"}'::jsonb
WHERE "key" = 'iso27001.p1s4.req-identification';
