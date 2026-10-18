-- Insert ISMS-SCOPE template
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000004',
    'ISMS-SCOPE',
    'ISMS Scope Document',
    '1.0',
    'Defines the boundaries of the Information Security Management System — which departments, processes, locations, and IT infrastructure are covered (ISO/IEC 27001 clause 4.3).',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- Insert wizard questions
INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Page 1: Front Page
    ('d0c00000-0000-4000-8000-000000004101', 'd0c00000-0000-4000-8000-000000000004', 'company_name', 'Company name', 'The name of your company or organization.', 'TEXT', true, NULL, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000004102', 'd0c00000-0000-4000-8000-000000000004', 'document_code', 'Document code', 'The document coding system should be in line with the company''s existing system for document coding. Example: "IS-P-001".', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000004103', 'd0c00000-0000-4000-8000-000000000004', 'author', 'Author', 'The name of the person who wrote this document.', 'PERSON', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000004104', 'd0c00000-0000-4000-8000-000000000004', 'approver', 'Approver', 'The name of the person with authority to approve this document.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000004105', 'd0c00000-0000-4000-8000-000000000004', 'confidentiality_level', 'Confidentiality level', 'Use your existing classification system to label the documents.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 5, NOW()),

    -- Page 2: Purpose, scope, and users
    ('d0c00000-0000-4000-8000-000000004201', 'd0c00000-0000-4000-8000-000000000004', 'job_titles', 'Job titles with access', 'What other job titles should have access to the ISMS scope document? E.g., IT department, Security department, Compliance department.', 'LONGTEXT', true, NULL, 2, 1, NOW()),

    -- Page 3: Departments
    ('d0c00000-0000-4000-8000-000000004301', 'd0c00000-0000-4000-8000-000000000004', 'departments', 'Departments in scope', 'Which departments will be included in the ISMS scope? E.g., IT department, HR department, Sales department. For companies smaller than 50 employees, write "All departments are included in the scope."', 'LONGTEXT', true, NULL, 3, 1, NOW()),

    -- Page 4: Processes and services
    ('d0c00000-0000-4000-8000-000000004401', 'd0c00000-0000-4000-8000-000000000004', 'processes', 'Processes and services in scope', 'Which processes will be included in the ISMS scope? E.g., maintenance of production server process, software development process. For companies smaller than 50 employees, write "All processes are included in the scope."', 'LONGTEXT', true, NULL, 4, 1, NOW()),

    -- Page 5: Locations
    ('d0c00000-0000-4000-8000-000000004501', 'd0c00000-0000-4000-8000-000000000004', 'locations', 'Locations in scope', 'Which locations will be included in the ISMS scope? E.g., Headquarters at XYZ street, Branch office at ABC street. For companies smaller than 50 employees, write "All locations are included in the scope."', 'LONGTEXT', true, NULL, 5, 1, NOW()),

    -- Page 6: IT infrastructure
    ('d0c00000-0000-4000-8000-000000004601', 'd0c00000-0000-4000-8000-000000000004', 'it_infrastructure', 'IT infrastructure in scope', 'Which IT infrastructure will be included in the scope? Do not list all IT assets — just outline the main technology you are using. E.g., AWS virtual servers, Microsoft 365, private network in the office.', 'LONGTEXT', true, NULL, 6, 1, NOW()),

    -- Page 7: Exclusions from the scope
    ('d0c00000-0000-4000-8000-000000004701', 'd0c00000-0000-4000-8000-000000000004', 'exclusions', 'Exclusions from scope', 'What will be excluded from the ISMS scope? E.g., students on temporary jobs, third-party contractors, private devices, home offices. For cloud services you can specify that you exclude elements you do not control.', 'LONGTEXT', true, NULL, 7, 1, NOW()),

    -- Page 8: Validity and document management
    ('d0c00000-0000-4000-8000-000000004801', 'd0c00000-0000-4000-8000-000000000004', 'validity_date', 'Effective date', 'On which date will this document become effective? Specify this date only once you have a final version of the document for approval.', 'DATE', true, NULL, 8, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000004802', 'd0c00000-0000-4000-8000-000000000004', 'document_owner', 'Document owner', 'Who is the owner of this document? Typically the main person in charge of managing internal or compliance processes — e.g., Office Manager, Compliance Officer, CISO.', 'TEXT', true, NULL, 8, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000004803', 'd0c00000-0000-4000-8000-000000000004', 'review_frequency', 'Review frequency', 'How often must the document be reviewed and, if necessary, updated? For example, once a year.', 'TEXT', true, NULL, 8, 3, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;

-- Backfill step 6 into existing projects
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p1s6.isms-scope',
  'ISMS Scope Document',
  'Define the boundaries of the ISMS — which departments, processes, locations, and IT infrastructure are covered.',
  'DOCUMENT',
  6,
  'NOT_STARTED',
  '{"clause": "Clause 4.3", "workload_hours": 4, "estimated_days": 2, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Project Preparation'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p1s6.isms-scope'
  );
