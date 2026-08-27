-- ============================================================
-- Backfill Step 4 (Procedure for Identification of Requirements)
-- ============================================================

INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "metadata_json", "updated_at")
SELECT gen_random_uuid(),
       p."id",
       x."key",
       x."title",
       x."purpose",
       x."type"::"StepType",
       x."order",
       x."metadata_json"::jsonb,
       NOW()
FROM "project_phases" p
CROSS JOIN (VALUES
    ('iso27001.p1s4.req-identification',
     'Procedure for Identification of Requirements',
     'Define the process of identification of interested parties, statutory, regulatory, contractual and other requirements related to information security, and responsibilities for their fulfillment.',
     'DOCUMENT',
     4,
     '{"workload_hours": 1, "estimated_days": 2, "mandatory": false}')
) AS x("key", "title", "purpose", "type", "order", "metadata_json")
WHERE p."order" = 1
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = x."key"
  );

-- ============================================================
-- Seed the REQ-IDENTIFICATION document template
-- ============================================================

INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000003',
    'REQ-IDENTIFICATION',
    'Procedure for Identification of Requirements',
    '1.0',
    'Defines the process of identification of interested parties, legal, regulatory, contractual and other requirements related to information security, and responsibilities for their fulfillment.',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

-- ============================================================
-- Template questions (10 questions across 3 wizard pages)
-- ============================================================

INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Wizard page 1 — Document info (front page)
    ('d0c00000-0000-4000-8000-000000003001', 'd0c00000-0000-4000-8000-000000000003', 'company_name', 'Company name', 'The legal name of your organization as it should appear on the front page.', 'TEXT', true, NULL, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000003002', 'd0c00000-0000-4000-8000-000000000003', 'document_code', 'Document code', 'Unique code for this document, e.g. ISMS-REQ-001.', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000003003', 'd0c00000-0000-4000-8000-000000000003', 'author', 'Author', 'Person who wrote this procedure. Defaults to you.', 'PERSON', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000003004', 'd0c00000-0000-4000-8000-000000000003', 'approver', 'Approver', 'Person who approves this document. Usually a member of top management.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000003005', 'd0c00000-0000-4000-8000-000000000003', 'confidentiality_level', 'Confidentiality level', 'Classification shown on the front page and in document headers.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 5, NOW()),
    ('d0c00000-0000-4000-8000-000000003006', 'd0c00000-0000-4000-8000-000000000003', 'validity_date', 'Validity date', 'Date from which this document is considered valid/effective.', 'DATE', true, NULL, 1, 6, NOW()),

    -- Wizard page 2 — Content details
    ('d0c00000-0000-4000-8000-000000003101', 'd0c00000-0000-4000-8000-000000000003', 'compliance_job_title', 'Compliance job title', 'Which job title/role is responsible for identifying interested parties and their requirements, reviewing the list, and publishing updates? This placeholder appears multiple times in the document.', 'TEXT', true, NULL, 2, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000003102', 'd0c00000-0000-4000-8000-000000000003', 'publishing_guidelines', 'Publishing guidelines', 'How and where will the List of Legal, Regulatory, Contractual and Other Requirements be published (e.g., intranet folder, shared drive, specific format)?', 'TEXT', true, NULL, 2, 2, NOW()),

    -- Wizard page 3 — Validity and document management
    ('d0c00000-0000-4000-8000-000000003201', 'd0c00000-0000-4000-8000-000000000003', 'document_owner', 'Document owner (job title)', 'Who (job title) will own this document going forward and be responsible for periodic review?', 'TEXT', true, NULL, 3, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000003202', 'd0c00000-0000-4000-8000-000000000003', 'update_period', 'Review/update period', 'How often must the document owner review/update this document (e.g., annually, every 2 years)?', 'TEXT', true, NULL, 3, 2, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;
