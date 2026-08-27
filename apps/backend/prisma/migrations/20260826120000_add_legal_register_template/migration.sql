-- Create a template for the legal requirements register
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "created_at", "updated_at")
VALUES (
  gen_random_uuid(),
  'LEGAL-REGISTER',
  'Register of Legal, Contractual, and Other Requirements',
  '1.0',
  'Auto-generated register from the requirements step.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
