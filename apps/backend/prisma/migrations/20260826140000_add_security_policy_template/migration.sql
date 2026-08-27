-- Insert SECURITY-POLICY template
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000005',
    'SECURITY-POLICY',
    'Information Security Policy',
    '1.0',
    'Defines the purpose, direction, principles and basic rules for information security management — top-level policy for the ISMS (ISO/IEC 27001 clauses 5.2 and 5.3).',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- Insert wizard questions
INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Page 1: Front Page
    ('d0c00000-0000-4000-8000-000000005101', 'd0c00000-0000-4000-8000-000000000005', 'company_name', 'Company name', 'The name of your company or organization.', 'TEXT', true, NULL, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000005102', 'd0c00000-0000-4000-8000-000000000005', 'document_code', 'Document code', 'The document coding system should be in line with the company''s existing system for document coding. Example: "IS-P-001".', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000005103', 'd0c00000-0000-4000-8000-000000000005', 'author', 'Author', 'The name of the person who wrote this document.', 'PERSON', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000005104', 'd0c00000-0000-4000-8000-000000000005', 'approver', 'Approver', 'The name of the person with authority to approve this document.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000005105', 'd0c00000-0000-4000-8000-000000000005', 'confidentiality_level', 'Confidentiality level', 'Use your existing classification system to label the documents.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 5, NOW()),

    -- Page 2: Reference documents
    ('d0c00000-0000-4000-8000-000000005201', 'd0c00000-0000-4000-8000-000000000005', 'reference_documents', 'Reference documents', 'Which other internal documents of the company are associated with this Policy? E.g., strategic development plan, business plan, document on strategic risk management.', 'LONGTEXT', true, NULL, 2, 1, NOW()),

    -- Page 3: Objectives and measurement
    ('d0c00000-0000-4000-8000-000000005301', 'd0c00000-0000-4000-8000-000000000005', 'security_objectives', 'Security objectives', 'What are the top-level security objectives for your whole ISMS? E.g., "Decrease the number of incidents by 20% during the next 12 months."', 'LONGTEXT', true, NULL, 3, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000005302', 'd0c00000-0000-4000-8000-000000000005', 'objectives_reviewer', 'Objectives reviewer', 'Who is in charge of reviewing general security objectives? E.g., Chief Information Security Officer (CISO).', 'PERSON', true, NULL, 3, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000005303', 'd0c00000-0000-4000-8000-000000000005', 'security_manager_title', 'Security manager job title', 'What is the job title of the person in charge of managing security in your company? E.g., CISO, CTO, CIO.', 'TEXT', true, NULL, 3, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000005304', 'd0c00000-0000-4000-8000-000000000005', 'objectives_review_frequency', 'Objectives review frequency', 'How often must the objectives be reviewed and, if necessary, updated? For example, once a year.', 'TEXT', true, NULL, 3, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000005305', 'd0c00000-0000-4000-8000-000000000005', 'measurement_methodology_person', 'Measurement methodology person', 'Who is in charge of setting the measurement methodology? E.g., CFO, CISO.', 'PERSON', true, NULL, 3, 5, NOW()),
    ('d0c00000-0000-4000-8000-000000005306', 'd0c00000-0000-4000-8000-000000000005', 'measurement_reporting_person', 'Measurement reporting person', 'Who is in charge of reporting the achievement of objectives? E.g., CISO, security analyst.', 'PERSON', true, NULL, 3, 6, NOW()),

    -- Page 4: Responsibilities
    ('d0c00000-0000-4000-8000-000000005401', 'd0c00000-0000-4000-8000-000000000005', 'top_executive_title', 'Top executive job title', 'What is the job title of the person in charge of overseeing security? This is typically the CEO or other executive sponsoring the ISO 27001 project.', 'TEXT', true, NULL, 4, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000005402', 'd0c00000-0000-4000-8000-000000000005', 'training_awareness_title', 'Training and awareness job title', 'What is the job title of the person in charge of training and awareness activities? E.g., Training Manager, HR Manager, CISO.', 'TEXT', true, NULL, 4, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000005403', 'd0c00000-0000-4000-8000-000000000005', 'incident_receiver', 'Incident receiver', 'Who is in charge of receiving information about security incidents and weaknesses? This might be one person or a department.', 'TEXT', true, NULL, 4, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000005404', 'd0c00000-0000-4000-8000-000000000005', 'security_communicator', 'Security communicator', 'Who is in charge of communicating security issues with interested parties? E.g., CISO, PR Manager.', 'TEXT', true, NULL, 4, 4, NOW()),

    -- Page 5: Policy communication
    ('d0c00000-0000-4000-8000-000000005501', 'd0c00000-0000-4000-8000-000000000005', 'policy_communicator', 'Policy communicator', 'What is the job title of the person in charge of communicating the Information Security Policy? E.g., CISO, CEO.', 'TEXT', true, NULL, 5, 1, NOW()),

    -- Page 6: Validity and document management
    ('d0c00000-0000-4000-8000-000000005601', 'd0c00000-0000-4000-8000-000000000005', 'validity_date', 'Effective date', 'On which date will this document become effective? Specify this date only once you have a final version of the document for approval.', 'DATE', true, NULL, 6, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000005602', 'd0c00000-0000-4000-8000-000000000005', 'document_owner', 'Document owner', 'Who is the owner of this document? E.g., Office Manager, Compliance Officer, CISO.', 'TEXT', true, NULL, 6, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000005603', 'd0c00000-0000-4000-8000-000000000005', 'review_frequency', 'Review frequency', 'How often must the document be reviewed and, if necessary, updated? For example, once a year.', 'TEXT', true, NULL, 6, 3, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;

-- Backfill step 7 into existing projects
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p1s7.security-policy',
  'Information Security Policy',
  'Define the top-level policy for information security management — purpose, direction, principles and basic rules for the ISMS.',
  'DOCUMENT',
  7,
  'NOT_STARTED',
  '{"clause": "Clauses 5.2 and 5.3", "workload_hours": 4, "estimated_days": 2, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Project Preparation'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p1s7.security-policy'
  );
