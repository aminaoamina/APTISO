-- CreateTable
CREATE TABLE "risk_asset_vuln_links" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "vulnerability_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_asset_vuln_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_vuln_threat_links" (
    "id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "vulnerability_id" UUID NOT NULL,
    "threat_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_vuln_threat_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_controls" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,

    CONSTRAINT "risk_controls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_item_controls" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "control_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_item_controls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_asset_vuln_links_step_id_idx" ON "risk_asset_vuln_links"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_asset_vuln_links_asset_id_vulnerability_id_key" ON "risk_asset_vuln_links"("asset_id", "vulnerability_id");

-- CreateIndex
CREATE INDEX "risk_vuln_threat_links_step_id_idx" ON "risk_vuln_threat_links"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_vuln_threat_links_vulnerability_id_threat_id_key" ON "risk_vuln_threat_links"("vulnerability_id", "threat_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_controls_code_key" ON "risk_controls"("code");

-- CreateIndex
CREATE INDEX "risk_controls_code_idx" ON "risk_controls"("code");

-- CreateIndex
CREATE INDEX "risk_item_controls_control_id_idx" ON "risk_item_controls"("control_id");

-- CreateIndex
CREATE UNIQUE INDEX "risk_item_controls_item_id_control_id_key" ON "risk_item_controls"("item_id", "control_id");

-- AddForeignKey
ALTER TABLE "risk_asset_vuln_links" ADD CONSTRAINT "risk_asset_vuln_links_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_vuln_links" ADD CONSTRAINT "risk_asset_vuln_links_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "risk_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_asset_vuln_links" ADD CONSTRAINT "risk_asset_vuln_links_vulnerability_id_fkey" FOREIGN KEY ("vulnerability_id") REFERENCES "risk_vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_vuln_threat_links" ADD CONSTRAINT "risk_vuln_threat_links_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_vuln_threat_links" ADD CONSTRAINT "risk_vuln_threat_links_vulnerability_id_fkey" FOREIGN KEY ("vulnerability_id") REFERENCES "risk_vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_vuln_threat_links" ADD CONSTRAINT "risk_vuln_threat_links_threat_id_fkey" FOREIGN KEY ("threat_id") REFERENCES "risk_threats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_item_controls" ADD CONSTRAINT "risk_item_controls_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "risk_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_item_controls" ADD CONSTRAINT "risk_item_controls_control_id_fkey" FOREIGN KEY ("control_id") REFERENCES "risk_controls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ============================================================
-- Risk register output document templates (no wizard questions)
-- ============================================================
INSERT INTO "document_templates" ("id", "code", "name", "version", "description", "updated_at")
VALUES
    ('d0c00000-0000-4000-8000-000000000007', 'RISK-REPORT', 'Risk Assessment and Treatment Report', '1.0', 'Report of the information security risk assessment and treatment results (ISO/IEC 27001 clauses 6.1, 8.2, 8.3).', NOW()),
    ('d0c00000-0000-4000-8000-000000000008', 'RISK-STATEMENT', 'Statement of Acceptance of Residual Risks', '1.0', 'Statement of the acceptance of residual risks identified during the information security risk assessment.', NOW())
ON CONFLICT ("code") DO NOTHING;
