-- ============================================================
-- Implementation steps + guided document foundation
--  - ProjectStep (child of ProjectPhase)
--  - DocumentTemplate / TemplateQuestion / DocumentInstance
--  - Rename Phase 1 to "Project Preparation" and backfill its
--    first two ISO 27001 steps for every existing project
--  - Seed the DOC-CONTROL template reference data (idempotent)
-- ============================================================

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('EDUCATIONAL', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('NOT_STARTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TemplateInputType" AS ENUM ('TEXT', 'LONGTEXT', 'PERSON', 'SELECT', 'DATE');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED');

-- AlterEnum (new values are not used elsewhere in this migration)
ALTER TYPE "AuditAction" ADD VALUE 'STEP_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_UPDATED';

-- CreateTable
CREATE TABLE "project_steps" (
    "id" UUID NOT NULL,
    "phase_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "purpose" TEXT,
    "type" "StepType" NOT NULL DEFAULT 'EDUCATIONAL',
    "order" INTEGER NOT NULL,
    "status" "StepStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "version" VARCHAR(20) NOT NULL DEFAULT '1.0',
    "description" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_questions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "help_text" TEXT,
    "input_type" "TemplateInputType" NOT NULL DEFAULT 'TEXT',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    "wizard_page" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "template_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_instances" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "step_id" UUID,
    "title" VARCHAR(250) NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "version" VARCHAR(20) NOT NULL DEFAULT '0.1',
    "content" JSONB NOT NULL,
    "answers" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "document_instances_pkey" PRIMARY KEY ("id")
);

-- CreateForeignKeys
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "project_phases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "template_questions" ADD CONSTRAINT "template_questions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_instances" ADD CONSTRAINT "document_instances_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndexes
CREATE UNIQUE INDEX "project_steps_phase_id_key_key" ON "project_steps"("phase_id", "key");
CREATE UNIQUE INDEX "project_steps_phase_id_order_key" ON "project_steps"("phase_id", "order");
CREATE INDEX "project_steps_phase_id_idx" ON "project_steps"("phase_id");

CREATE UNIQUE INDEX "document_templates_code_key" ON "document_templates"("code");

CREATE UNIQUE INDEX "template_questions_template_id_key_key" ON "template_questions"("template_id", "key");
CREATE INDEX "template_questions_template_id_wizard_page_order_idx" ON "template_questions"("template_id", "wizard_page", "order");

CREATE UNIQUE INDEX "document_instances_step_id_key" ON "document_instances"("step_id");
CREATE INDEX "document_instances_template_id_idx" ON "document_instances"("template_id");
CREATE INDEX "document_instances_created_by_idx" ON "document_instances"("created_by");

-- ============================================================
-- Data: align Phase 1 with the ISO 27001 implementation model
-- ============================================================

UPDATE "project_phases"
SET "name" = 'Project Preparation',
    "description" = 'Prepare the ISMS project: align the team, set scope foundations and governance basics'
WHERE "order" = 1
  AND "name" <> 'Project Preparation';

-- Backfill Phase 1 steps for every existing project (all current projects are ISO 27001)
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
    ('iso27001.p1s1.intro',
     'Introduction to the ISO 27001 Implementation Process',
     'Align leadership and the project team on what implementing ISO 27001 involves before any working steps begin.',
     'EDUCATIONAL',
     1),
    ('iso27001.p1s2.doc-control',
     'Procedure for Document and Record Control',
     'Define how documents and records are governed: creation, approval, publishing, distribution and withdrawal.',
     'DOCUMENT',
     2)
) AS x("key", "title", "purpose", "type", "order")
WHERE p."order" = 1
  AND NOT EXISTS (SELECT 1 FROM "project_steps" s WHERE s."phase_id" = p."id");

-- ============================================================
-- Data: seed the Procedure for Document and Record Control template
-- (reference data, same pattern as compliance frameworks)
-- ============================================================

INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES (
    'd0c00000-0000-4000-8000-000000000001',
    'DOC-CONTROL',
    'Procedure for Document and Record Control',
    '1.0',
    'Governs creation, approval, publishing, distribution and withdrawal of ISMS documents and records (ISO/IEC 27001 clause 7.5, control A.5.33).',
    NOW()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "template_questions"
    ("id", "template_id", "key", "label", "help_text", "input_type", "required", "options", "wizard_page", "order", "updated_at")
VALUES
    -- Wizard page 1 — Front page and general information
    ('d0c00000-0000-4000-8000-000000000101', 'd0c00000-0000-4000-8000-000000000001', 'applicability', 'This procedure applies to', 'Decide whether document control covers only information security documentation or all company documentation.', 'SELECT', true, '["Information security documentation only","All company documentation"]'::jsonb, 1, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000000102', 'd0c00000-0000-4000-8000-000000000001', 'company_name', 'Company name', 'The legal name of your organization as it should appear on the front page.', 'TEXT', true, NULL, 1, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000000103', 'd0c00000-0000-4000-8000-000000000001', 'document_code', 'Document code', 'Unique code for this document, e.g. ISMS-PRO-001. Define a convention and stay consistent.', 'TEXT', true, NULL, 1, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000000104', 'd0c00000-0000-4000-8000-000000000001', 'author', 'Author', 'Person who wrote this procedure. Defaults to you.', 'PERSON', true, NULL, 1, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000000105', 'd0c00000-0000-4000-8000-000000000001', 'approver', 'Approver', 'Person who approves this procedure. Usually a member of top management.', 'PERSON', true, NULL, 1, 5, NOW()),
    ('d0c00000-0000-4000-8000-000000000106', 'd0c00000-0000-4000-8000-000000000001', 'confidentiality_level', 'Confidentiality level', 'Classification shown on the front page and in document headers.', 'SELECT', true, '["Public","Internal","Confidential"]'::jsonb, 1, 6, NOW()),

    -- Wizard page 2 — Reference documents
    ('d0c00000-0000-4000-8000-000000000201', 'd0c00000-0000-4000-8000-000000000001', 'reference_documents', 'Other reference documents', 'Laws, regulations, contracts or internal policies that specify document control in your company. ISO/IEC 27001 clause 7.5, control A.5.33, the Information Security Policy and the Information Classification Policy are always included.', 'LONGTEXT', false, NULL, 2, 1, NOW()),

    -- Wizard page 3 — Document formatting
    ('d0c00000-0000-4000-8000-000000000301', 'd0c00000-0000-4000-8000-000000000001', 'formatting_standard', 'Formatting standard for ISMS documents', 'Describe your formatting rules: fonts and sizes for headings and body text, header/footer content rules, numbering conventions.', 'LONGTEXT', true, NULL, 3, 1, NOW()),

    -- Wizard page 4 — Document approval
    ('d0c00000-0000-4000-8000-000000000401', 'd0c00000-0000-4000-8000-000000000001', 'approval_responsibility', 'Who approves which documents', 'Specify who approves which kinds of documents, e.g. the CEO approves policies, the IT manager approves technical procedures.', 'LONGTEXT', true, NULL, 4, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000000402', 'd0c00000-0000-4000-8000-000000000001', 'approval_method', 'How documents are approved', 'The practical method used to approve a document.', 'SELECT', true, '["Approval via email","Sign-off in a shared cloud folder","Status change in APTISO","Physical signature"]'::jsonb, 4, 2, NOW()),

    -- Wizard page 5 — Publishing, distribution and withdrawal
    ('d0c00000-0000-4000-8000-000000000501', 'd0c00000-0000-4000-8000-000000000001', 'publishing_role', 'Job title that publishes documents', 'Who is responsible for publishing new documents and new versions, e.g. Document Controller or CISO.', 'TEXT', true, NULL, 5, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000000502', 'd0c00000-0000-4000-8000-000000000001', 'publishing_method', 'How documents are published', 'Where and how published documents are made available, e.g. uploaded to the intranet with reading rights.', 'LONGTEXT', true, NULL, 5, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000000503', 'd0c00000-0000-4000-8000-000000000001', 'distribution_role', 'Job title that distributes documents', 'Who informs employees about published documents and distributes printed versions if they exist.', 'TEXT', true, NULL, 5, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000000504', 'd0c00000-0000-4000-8000-000000000001', 'notification_method', 'How users are informed about new documents', 'e.g. an announcement email with a link to the intranet location.', 'LONGTEXT', true, NULL, 5, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000000505', 'd0c00000-0000-4000-8000-000000000001', 'obsolete_handling', 'How obsolete documents are withdrawn', 'What happens to superseded versions, both digital copies and printed originals.', 'LONGTEXT', true, NULL, 5, 5, NOW()),

    -- Wizard page 6 — Documents of external origin
    ('d0c00000-0000-4000-8000-000000000601', 'd0c00000-0000-4000-8000-000000000001', 'external_register_location', 'Where external documents are recorded', 'The register or location where correspondence, standards, contracts and specifications received from outside are logged.', 'TEXT', true, NULL, 6, 1, NOW()),

    -- Wizard page 7 — Managing records
    ('d0c00000-0000-4000-8000-000000000701', 'd0c00000-0000-4000-8000-000000000001', 'record_name', 'Record name', 'Name of the record kept on the basis of this procedure, e.g. Register of external correspondence.', 'TEXT', true, NULL, 7, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000000702', 'd0c00000-0000-4000-8000-000000000001', 'record_storage_location', 'Storage location', 'Where the record is stored, e.g. company intranet.', 'TEXT', true, NULL, 7, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000000703', 'd0c00000-0000-4000-8000-000000000001', 'record_responsible', 'Person responsible for storage', 'Job title of the person responsible for keeping the record and granting access to it.', 'TEXT', true, NULL, 7, 3, NOW()),
    ('d0c00000-0000-4000-8000-000000000704', 'd0c00000-0000-4000-8000-000000000001', 'record_protection', 'Controls for record protection', 'How the record is protected, e.g. only the responsible person may make entries and changes.', 'LONGTEXT', false, NULL, 7, 4, NOW()),
    ('d0c00000-0000-4000-8000-000000000705', 'd0c00000-0000-4000-8000-000000000001', 'record_retention', 'Retention time', 'How long the record is stored before destruction, e.g. 5 years.', 'TEXT', true, NULL, 7, 5, NOW()),

    -- Wizard page 8 — Validity and document management
    ('d0c00000-0000-4000-8000-000000000801', 'd0c00000-0000-4000-8000-000000000001', 'validity_date', 'Validity date', 'Date from which this procedure is valid.', 'DATE', true, NULL, 8, 1, NOW()),
    ('d0c00000-0000-4000-8000-000000000802', 'd0c00000-0000-4000-8000-000000000001', 'document_owner', 'Document owner', 'Job title of the person responsible for keeping this procedure up to date.', 'TEXT', true, NULL, 8, 2, NOW()),
    ('d0c00000-0000-4000-8000-000000000803', 'd0c00000-0000-4000-8000-000000000001', 'review_frequency', 'Review frequency', 'How often the owner must review the document, e.g. every 12 months.', 'TEXT', true, NULL, 8, 3, NOW())
ON CONFLICT ("template_id", "key") DO NOTHING;
