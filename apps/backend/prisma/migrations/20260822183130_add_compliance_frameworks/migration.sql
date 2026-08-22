-- CreateEnum
CREATE TYPE "FrameworkStatus" AS ENUM ('AVAILABLE', 'COMING_SOON');

-- CreateTable
CREATE TABLE "compliance_frameworks" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "version" VARCHAR(50),
    "status" "FrameworkStatus" NOT NULL DEFAULT 'COMING_SOON',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "compliance_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_frameworks_code_key" ON "compliance_frameworks"("code");

-- Reference data: compliance framework catalog
INSERT INTO "compliance_frameworks" ("id", "code", "name", "description", "version", "status", "updated_at") VALUES
    ('3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b01', 'iso_27001', 'ISO/IEC 27001', 'Information security management systems', '2022', 'AVAILABLE', NOW()),
    ('3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b02', 'iso_27002', 'ISO/IEC 27002', 'Information security controls', '2022', 'COMING_SOON', NOW()),
    ('3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b03', 'iso_27701', 'ISO/IEC 27701', 'Privacy information management', '2019', 'COMING_SOON', NOW()),
    ('3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b04', 'iso_22301', 'ISO 22301', 'Business continuity management systems', '2019', 'COMING_SOON', NOW()),
    ('3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b05', 'iso_9001', 'ISO 9001', 'Quality management systems', '2015', 'COMING_SOON', NOW())
ON CONFLICT ("code") DO NOTHING;

-- AddColumn (nullable first, backfilled below, then constrained)
ALTER TABLE "compliance_projects" ADD COLUMN "compliance_framework_id" UUID;

-- Backfill existing projects to the default supported framework
UPDATE "compliance_projects"
SET "compliance_framework_id" = '3f7a1c2e-9b4d-4e8a-a6c1-0d5e8f2a7b01'
WHERE "compliance_framework_id" IS NULL;

ALTER TABLE "compliance_projects" ALTER COLUMN "compliance_framework_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "compliance_projects" ADD CONSTRAINT "compliance_projects_compliance_framework_id_fkey" FOREIGN KEY ("compliance_framework_id") REFERENCES "compliance_frameworks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
