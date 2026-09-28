-- Insert RISK-METHODOLOGY template
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000006',
    'RISK-METHODOLOGY',
    'Risk Assessment and Risk Treatment Methodology',
    '1.0',
    'Defines the methodology for assessment and treatment of information risks, and the acceptable level of risk (ISO/IEC 27001 clauses 6.1, 8.2, and 8.3).',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- Insert wizard questions
INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Page 1: Front Page
    ('d0c00000-0000-4000-8000-000000006101', 'd0c00000-0000-4000-8000-000000000006', 'company_name', 'Company name', 'The name of your company or organization.', 'TEXT', true, NULL, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000006102', 'd0c00000-0000-4000-8000-000000000006', 'document_code', 'Document code', 'The document coding system should be in line with the company''s existing system for document coding. Example: "IS-P-001".', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000006103', 'd0c00000-0000-4000-8000-000000000006', 'author', 'Author', 'The name of the person who wrote this document.', 'PERSON', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000006104', 'd0c00000-0000-4000-8000-000000000006', 'approver', 'Approver', 'The name of the person with authority to approve this document.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000006105', 'd0c00000-0000-4000-8000-000000000006', 'confidentiality_level', 'Confidentiality level', 'Use your existing classification system to label the documents.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 5, NOW()),

    -- Page 2: Risk Assessment
    ('d0c00000-0000-4000-8000-000000006201', 'd0c00000-0000-4000-8000-000000000006', 'risk_management_coordinator', 'Risk management coordinator', 'Who is in charge of coordinating risk assessment and treatment? E.g., Chief Information Security Officer (CISO), Security Manager, ISO 27001 Project Manager.', 'TEXT', true, NULL, 2, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000006202', 'd0c00000-0000-4000-8000-000000000006', 'reference_documents', 'Reference documents', 'Which other internal documents are associated with this methodology? ISO/IEC 27001 standard, Information Security Policy and ISMS Scope Document are always included.', 'LONGTEXT', false, NULL, 2, 2, NOW()),

    -- Page 3: Statement of Applicability and Risk Treatment Plan
    ('d0c00000-0000-4000-8000-000000006301', 'd0c00000-0000-4000-8000-000000000006', 'security_manager_title', 'Security manager job title', 'What is the job title of the person in charge of managing security in your company? E.g., CISO, CTO, CIO.', 'TEXT', true, NULL, 3, 1, NOW()),

    -- Page 4: Reporting
    ('d0c00000-0000-4000-8000-000000006401', 'd0c00000-0000-4000-8000-000000000006', 'top_executive_title', 'Top executive job title', 'What is the job title of the person who is the sponsor of the ISO 27001 project? This is typically the CEO or other executive in charge of overseeing security.', 'TEXT', true, NULL, 4, 1, NOW()),

    -- Page 5: Managing records
    ('d0c00000-0000-4000-8000-000000006501', 'd0c00000-0000-4000-8000-000000000006', 'risk_documents_storage', 'Storage location for risk management documents', 'Where do you store risk management documents? E.g., a folder on your document management system, a cloud service.', 'TEXT', true, NULL, 5, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000006502', 'd0c00000-0000-4000-8000-000000000006', 'retention_period', 'Retention period for older versions', 'For how long must older versions of the Risk Treatment Plan be stored? E.g., 3 years, or a period defined by legal, regulatory, or contractual requirements.', 'TEXT', true, NULL, 5, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000006503', 'd0c00000-0000-4000-8000-000000000006', 'document_owner', 'Document owner (job title)', 'Job title of the person responsible for keeping this document up to date.', 'TEXT', true, NULL, 5, 3, NOW()),

    -- Page 6: Validity and document management
    ('d0c00000-0000-4000-8000-000000006601', 'd0c00000-0000-4000-8000-000000000006', 'validity_date', 'Effective date', 'On which date will this document become effective? Specify this date only once you have a final version of the document for approval.', 'DATE', true, NULL, 6, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000006602', 'd0c00000-0000-4000-8000-000000000006', 'review_frequency', 'Review frequency', 'How often must the document be reviewed and, if necessary, updated? For example, once a year.', 'TEXT', true, NULL, 6, 2, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;

-- Backfill step 9 (Phase 2, Step 1) into existing projects
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p2s1.risk-methodology',
  'Risk Assessment and Risk Treatment Methodology',
  'Define the methodology for assessment and treatment of information risks, and the acceptable level of risk.',
  'DOCUMENT',
  1,
  'NOT_STARTED',
  '{"clause": "Clauses 6.1, 8.2, and 8.3", "workload_hours": 4, "estimated_days": 3, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Risk Assessment'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p2s1.risk-methodology'
  );
