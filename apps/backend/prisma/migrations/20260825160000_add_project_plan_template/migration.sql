-- ============================================================
-- Backfill Step 3 (Project Plan) for existing projects
-- ============================================================

INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "updated_at")
SELECT gen_random_uuid(),
       p."id",
       x."key",
       x."title",
       x."purpose",
       x."type"::"StepType",
       x."order",
       NOW()
FROM "project_phases" p
CROSS JOIN (VALUES
    ('iso27001.p1s3.project-plan',
     'Project Plan for ISMS Implementation',
     'Define the ISMS implementation objectives, deliverables, deadlines, responsibilities, project risks, and project management arrangements.',
     'DOCUMENT',
     3)
) AS x("key", "title", "purpose", "type", "order")
WHERE p."order" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = x."key"
  );

-- ============================================================
-- Seed the PROJECT-PLAN document template
-- ============================================================

INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000002',
    'PROJECT-PLAN',
    'Project Plan for ISMS Implementation',
    '1.0',
    'Defines the ISMS implementation project objective, deliverables, deadlines, roles and responsibilities, risks, and project management arrangements.',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- Template questions (23 questions across 6 wizard pages)
-- ============================================================

INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Wizard page 1 — Document info (front page)
    ('d0c00000-0000-4000-8000-000000002001', 'd0c00000-0000-4000-8000-000000000002', 'company_name', 'Company name', 'The legal name of your organization as it should appear on the front page.', 'TEXT', true, NULL, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002002', 'd0c00000-0000-4000-8000-000000000002', 'document_code', 'Document code', 'Unique code for this document, e.g. ISMS-PP-001.', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000002003', 'd0c00000-0000-4000-8000-000000000002', 'author', 'Author', 'Person who wrote this project plan. Defaults to you.', 'PERSON', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000002004', 'd0c00000-0000-4000-8000-000000000002', 'approver', 'Approver', 'Person who approves this project plan. Usually a member of top management.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000002005', 'd0c00000-0000-4000-8000-000000000002', 'confidentiality_level', 'Confidentiality level', 'Classification shown on the front page and in document headers.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 5, NOW()),
    ('d0c00000-0000-4000-8000-000000002006', 'd0c00000-0000-4000-8000-000000000002', 'validity_date', 'Validity date', 'Date from which this project plan is valid.', 'DATE', true, NULL, 1, 6, NOW()),

    -- Wizard page 2 — Scope and references
    ('d0c00000-0000-4000-8000-000000002101', 'd0c00000-0000-4000-8000-000000000002', 'purpose_scope', 'Purpose, scope and users', 'Describe the purpose of the project plan, what it covers, and who will use it.', 'LONGTEXT', true, NULL, 2, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002102', 'd0c00000-0000-4000-8000-000000000002', 'reference_documents', 'Reference documents', 'Other documents referenced by this project plan. ISO/IEC 27001 standard is always included.', 'LONGTEXT', false, NULL, 2, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000002103', 'd0c00000-0000-4000-8000-000000000002', 'top_management_designation', 'Top management designation', 'How the top management group is referred to in this document, e.g. Board of Directors.', 'TEXT', true, NULL, 2, 3, NOW()),

    -- Wizard page 3 — Project details
    ('d0c00000-0000-4000-8000-000000002201', 'd0c00000-0000-4000-8000-000000000002', 'target_date', 'Target date for ISMS implementation', 'The date by which the ISMS must be fully implemented.', 'DATE', true, NULL, 3, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002202', 'd0c00000-0000-4000-8000-000000000002', 'project_results', 'Project results (documents to be written)', 'List of all documents that will be created during the ISMS implementation. A default list is provided.', 'LONGTEXT', false, NULL, 3, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000002203', 'd0c00000-0000-4000-8000-000000000002', 'deadlines_overview', 'Deadlines for individual documents', 'Describe the planned deadlines for each document to be produced during the project.', 'LONGTEXT', true, NULL, 3, 3, NOW()),

    -- Wizard page 4 — Project organization
    ('d0c00000-0000-4000-8000-000000002301', 'd0c00000-0000-4000-8000-000000000002', 'project_sponsor', 'Project sponsor', 'Job title of the top executive who oversees the project but does not actively participate.', 'PERSON', true, NULL, 4, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002302', 'd0c00000-0000-4000-8000-000000000002', 'project_manager', 'Project manager', 'Name and job title of the person responsible for coordinating the project.', 'PERSON', true, NULL, 4, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000002303', 'd0c00000-0000-4000-8000-000000000002', 'team_members', 'Project team members', 'List team members, one per line. Format: Name, Organizational unit, Job title, Phone, E-mail', 'LONGTEXT', false, NULL, 4, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000002304', 'd0c00000-0000-4000-8000-000000000002', 'project_risks', 'Main project risks', 'Describe the main risks that could prevent successful completion of the ISMS implementation.', 'LONGTEXT', true, NULL, 4, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000002305', 'd0c00000-0000-4000-8000-000000000002', 'risk_controls', 'Measures to reduce risks', 'Describe the actions or controls that will mitigate the identified project risks.', 'LONGTEXT', true, NULL, 4, 5, NOW()),
    ('d0c00000-0000-4000-8000-000000002306', 'd0c00000-0000-4000-8000-000000000002', 'storage_folder', 'Shared folder location', 'Where project documents will be stored, e.g. SharePoint, Google Drive.', 'TEXT', true, NULL, 4, 6, NOW()),

    -- Wizard page 5 — Records and validity
    ('d0c00000-0000-4000-8000-000000002401', 'd0c00000-0000-4000-8000-000000000002', 'record_storage_period', 'Record retention period', 'How long the project implementation report is stored, e.g. 5 years.', 'TEXT', true, NULL, 5, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002402', 'd0c00000-0000-4000-8000-000000000002', 'document_owner', 'Document owner (job title)', 'Job title of the person responsible for keeping this project plan up to date.', 'TEXT', true, NULL, 5, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000002403', 'd0c00000-0000-4000-8000-000000000002', 'update_period', 'Review/update period', 'How often the owner must review the document, e.g. every 12 months.', 'TEXT', true, NULL, 5, 3, NOW()),

    -- Wizard page 6 — Step metadata
    ('d0c00000-0000-4000-8000-000000002501', 'd0c00000-0000-4000-8000-000000000002', 'est_workload_hours', 'Estimated workload (hours)', 'Estimated total hours to complete this step (writing + review).', 'TEXT', false, NULL, 6, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000002502', 'd0c00000-0000-4000-8000-000000000002', 'est_completion_days', 'Usually finished in (days)', 'Typical number of calendar days to complete this step.', 'TEXT', false, NULL, 6, 2, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;
