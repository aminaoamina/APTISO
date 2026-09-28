-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('INFRASTRUCTURE', 'IT_COMMUNICATION', 'SOFTWARE_DATABASE', 'DOCUMENTS_DATA', 'HUMAN_RESOURCES', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ThreatCategory" AS ENUM ('FORCE_MAJEURE', 'INTERNAL_OVERSIGHT', 'UNINTENTIONAL_MISTAKE', 'MALICIOUS_INTENT', 'TECHNICAL_ERROR');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('NEW', 'EDITED', 'APPROVED');

-- CreateEnum
CREATE TYPE "RiskAcceptability" AS ENUM ('ACCEPTABLE', 'NOT_ACCEPTABLE');

-- CreateEnum
CREATE TYPE "TreatmentOption" AS ENUM ('DECREASE', 'TRANSFER', 'AVOID', 'ACCEPT');

-- CreateEnum
CREATE TYPE "RiskApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "risk_assets" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_vulnerabilities" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "category" "AssetCategory" NOT NULL,
    "applicable_controls" JSON,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_vulnerabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_threats" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "name" VARCHAR(300) NOT NULL,
    "threat_category" "ThreatCategory" NOT NULL,
    "applicable_controls" JSON,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_threats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_items" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "vulnerability_id" UUID NOT NULL,
    "threat_id" UUID NOT NULL,
    "impact" INTEGER,
    "likelihood" INTEGER,
    "level" INTEGER,
    "acceptability" "RiskAcceptability",
    "risk_owner_id" UUID,
    "department" VARCHAR(200),
    "asset_owner_id" UUID,
    "comment" TEXT,
    "discarding" BOOLEAN NOT NULL DEFAULT false,
    "status" "RiskStatus" NOT NULL DEFAULT 'NEW',
    "has_incidents" BOOLEAN NOT NULL DEFAULT false,
    "is_reviewed" BOOLEAN NOT NULL DEFAULT false,
    "is_evaluated" BOOLEAN NOT NULL DEFAULT false,
    "treatment_option" "TreatmentOption" DEFAULT 'DECREASE',
    "treatment_controls" JSONB,
    "treatment_description" TEXT,
    "residual_risk" INTEGER,
    "treatment_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "approval_decision" "RiskApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "approval_by" UUID,
    "approval_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "risk_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_assets_step_id_idx" ON "risk_assets"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_assets_step_id_name_category_key" ON "risk_assets"("step_id", "name", "category");

-- CreateIndex
CREATE INDEX "risk_vulnerabilities_step_id_idx" ON "risk_vulnerabilities"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_vulnerabilities_step_id_name_category_key" ON "risk_vulnerabilities"("step_id", "name", "category");

-- CreateIndex
CREATE INDEX "risk_threats_step_id_idx" ON "risk_threats"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_threats_step_id_name_threat_category_key" ON "risk_threats"("step_id", "name", "threat_category");

-- CreateIndex
CREATE INDEX "risk_items_step_id_idx" ON "risk_items"("step_id");

-- CreateIndex
CREATE INDEX "risk_items_asset_id_idx" ON "risk_items"("asset_id");

-- CreateIndex
CREATE INDEX "risk_items_vulnerability_id_idx" ON "risk_items"("vulnerability_id");

-- CreateIndex
CREATE INDEX "risk_items_threat_id_idx" ON "risk_items"("threat_id");

-- CreateIndex
CREATE INDEX "risk_items_risk_owner_id_idx" ON "risk_items"("risk_owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_items_step_id_asset_id_vulnerability_id_threat_id_key" ON "risk_items"("step_id", "asset_id", "vulnerability_id", "threat_id");

-- AddForeignKey
ALTER TABLE "risk_assets" ADD CONSTRAINT "risk_assets_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_vulnerabilities" ADD CONSTRAINT "risk_vulnerabilities_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_threats" ADD CONSTRAINT "risk_threats_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "risk_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_vulnerability_id_fkey" FOREIGN KEY ("vulnerability_id") REFERENCES "risk_vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_threat_id_fkey" FOREIGN KEY ("threat_id") REFERENCES "risk_threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_risk_owner_id_fkey" FOREIGN KEY ("risk_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_asset_owner_id_fkey" FOREIGN KEY ("asset_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_items" ADD CONSTRAINT "risk_items_approval_by_fkey" FOREIGN KEY ("approval_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================
-- Backfill Phase 2 Step 2 (Risk Register) into existing projects
-- ============================================================
INSERT INTO "project_steps" ("id", "phase_id", "key", "title", "purpose", "type", "order", "status", "metadata_json", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  p.id,
  'iso27001.p2s2.risk-register',
  'Risk Register',
  'List the risks to your information, assess their impact and likelihood, and manage them through treatment and approval.',
  'REGISTER',
  2,
  'NOT_STARTED',
  '{"clause": "Clauses 6.1, 8.2, and 8.3", "workload_hours": 16, "estimated_days": 15, "mandatory": true}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "project_phases" p
WHERE p."name" = 'Risk Assessment'
  AND NOT EXISTS (
    SELECT 1 FROM "project_steps" s
    WHERE s."phase_id" = p."id" AND s."key" = 'iso27001.p2s2.risk-register'
  );
