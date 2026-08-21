-- CreateEnum
CREATE TYPE "OrganizationJoinRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORGANIZATION_JOIN_REQUEST');

-- CreateTable
CREATE TABLE "organization_join_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "invited_email" VARCHAR(150) NOT NULL,
    "requested_user_id" UUID,
    "role" "OrganizationRole" NOT NULL DEFAULT 'ORG_MEMBER',
    "status" "OrganizationJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "organization_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID,
    "join_request_id" UUID,
    "type" "NotificationType" NOT NULL,
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organization_join_requests_invited_email_status_idx" ON "organization_join_requests"("invited_email", "status");
CREATE INDEX "organization_join_requests_requested_user_id_status_idx" ON "organization_join_requests"("requested_user_id", "status");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- AddForeignKey
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_join_requests" ADD CONSTRAINT "organization_join_requests_requested_user_id_fkey" FOREIGN KEY ("requested_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_join_request_id_fkey" FOREIGN KEY ("join_request_id") REFERENCES "organization_join_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
