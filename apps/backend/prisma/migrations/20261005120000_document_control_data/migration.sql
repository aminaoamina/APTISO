-- Document control data lives on the document, not in its text, so exports always show current values.
ALTER TABLE "document_instances" ADD COLUMN "code" VARCHAR(50), ADD COLUMN "confidentiality" VARCHAR(50) NOT NULL DEFAULT 'Internal';

-- Wizard answers given so far become the document's control data.
UPDATE "document_instances" SET "code" = LEFT(NULLIF(TRIM("answers"->>'document_code'), ''), 50)
WHERE "answers" ? 'document_code';
UPDATE "document_instances" SET "confidentiality" = LEFT(TRIM("answers"->>'confidentiality_level'), 50)
WHERE NULLIF(TRIM("answers"->>'confidentiality_level'), '') IS NOT NULL;
UPDATE "document_instances" d SET "approver_id" = (d."answers"->>'approver')::uuid
WHERE d."approver_id" IS NULL AND d."answers"->>'approver' ~ '^[0-9a-f-]{36}$'
  AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = (d."answers"->>'approver')::uuid);
