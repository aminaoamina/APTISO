-- Backfill step 8 (Information Security Awareness) into existing projects
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p1s8.security-awareness',
  'Information Security Awareness',
  'Understand what security awareness training should cover, how to deliver it, and what evidence to maintain for audit.',
  'EDUCATIONAL',
  8,
  'NOT_STARTED',
  '{"clause": "Clause 7.2.2"}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Project Preparation'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p1s8.security-awareness'
  );
