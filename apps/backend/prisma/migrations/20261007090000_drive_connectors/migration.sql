-- Storage connectors: one drive per organization mirroring the document library (tokens encrypted).
-- CreateEnum
CREATE TYPE "DriveProvider" AS ENUM ('GOOGLE_DRIVE');

-- CreateEnum
CREATE TYPE "DriveConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT');

-- CreateEnum
CREATE TYPE "DriveSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "drive_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "DriveProvider" NOT NULL,
    "account_email" VARCHAR(255) NOT NULL,
    "root_folder_id" VARCHAR(200) NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "status" "DriveConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_error" VARCHAR(500),
    "last_sync_at" TIMESTAMP(6),
    "connected_by" UUID NOT NULL,
    "connected_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drive_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_folders" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "path" VARCHAR(1000) NOT NULL,
    "remote_id" VARCHAR(200) NOT NULL,

    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drive_sync_items" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "document_version_id" UUID NOT NULL,
    "status" "DriveSyncStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "remote_file_id" VARCHAR(200),
    "remote_path" VARCHAR(1000),
    "synced_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "drive_sync_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "drive_connections_organization_id_key" ON "drive_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "drive_folders_connection_id_path_key" ON "drive_folders"("connection_id", "path");

-- CreateIndex
CREATE INDEX "drive_sync_items_connection_id_status_idx" ON "drive_sync_items"("connection_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "drive_sync_items_connection_id_document_version_id_key" ON "drive_sync_items"("connection_id", "document_version_id");

-- AddForeignKey
ALTER TABLE "drive_connections" ADD CONSTRAINT "drive_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_connections" ADD CONSTRAINT "drive_connections_connected_by_fkey" FOREIGN KEY ("connected_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "drive_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_sync_items" ADD CONSTRAINT "drive_sync_items_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "drive_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drive_sync_items" ADD CONSTRAINT "drive_sync_items_document_version_id_fkey" FOREIGN KEY ("document_version_id") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

