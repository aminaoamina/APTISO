-- ============================================================
-- Align the risk register with the Risk Assessment and Treatment
-- Methodology (P2S1): impact 0-2, likelihood 0-2,
-- level = impact + likelihood (0-4), levels 3-4 are unacceptable.
--
-- The register previously used a 1-5 x 1-5 product with a threshold
-- of 8, which contradicted the methodology document (ISO/IEC 27001
-- clause 6.1.2 b requires consistent, comparable results). Values
-- captured on the old scale have no meaning on the new one, so all
-- evaluations, treatments and approvals are reset. Assets,
-- vulnerabilities, threats and the risk rows themselves are kept.
-- ============================================================

-- AlterTable
ALTER TABLE "risk_items"
  ADD COLUMN "residual_impact" INTEGER,
  ADD COLUMN "residual_likelihood" INTEGER,
  ADD COLUMN "approval_comment" TEXT,
  ADD COLUMN "existing_controls" TEXT,
  ALTER COLUMN "treatment_option" DROP DEFAULT;

-- Reset values captured on the old scale
UPDATE "risk_items" SET
  "impact" = NULL,
  "likelihood" = NULL,
  "level" = NULL,
  "acceptability" = NULL,
  "is_evaluated" = false,
  "is_reviewed" = false,
  "treatment_option" = NULL,
  "treatment_controls" = NULL,
  "treatment_description" = NULL,
  "residual_risk" = NULL,
  "treatment_confirmed" = false,
  "approval_decision" = 'PENDING',
  "approval_by" = NULL,
  "approval_at" = NULL,
  "status" = 'NEW';

DELETE FROM "risk_item_controls";

-- Guard the scale at the database level
ALTER TABLE "risk_items"
  ADD CONSTRAINT "risk_items_impact_range" CHECK ("impact" IS NULL OR "impact" BETWEEN 0 AND 2),
  ADD CONSTRAINT "risk_items_likelihood_range" CHECK ("likelihood" IS NULL OR "likelihood" BETWEEN 0 AND 2),
  ADD CONSTRAINT "risk_items_level_range" CHECK ("level" IS NULL OR "level" BETWEEN 0 AND 4),
  ADD CONSTRAINT "risk_items_residual_impact_range" CHECK ("residual_impact" IS NULL OR "residual_impact" BETWEEN 0 AND 2),
  ADD CONSTRAINT "risk_items_residual_likelihood_range" CHECK ("residual_likelihood" IS NULL OR "residual_likelihood" BETWEEN 0 AND 2),
  ADD CONSTRAINT "risk_items_residual_risk_range" CHECK ("residual_risk" IS NULL OR "residual_risk" BETWEEN 0 AND 4);

-- ============================================================
-- One output document per step: the acceptance of residual risks is
-- now a section of the Risk Assessment and Treatment Report
-- (document_instances.step_id is unique, so a second document for the
-- same step could never be created).
-- ============================================================
DELETE FROM "document_templates" t
WHERE t."code" = 'RISK-STATEMENT'
  AND NOT EXISTS (SELECT 1 FROM "document_instances" d WHERE d."template_id" = t."id");

UPDATE "document_templates"
SET "description" = 'Records of the information security risk assessment and risk treatment results, including the risk owners'' acceptance of residual risks (ISO/IEC 27001 clauses 6.1.2, 6.1.3, 8.2 and 8.3).',
    "updated_at" = NOW()
WHERE "code" = 'RISK-REPORT';
