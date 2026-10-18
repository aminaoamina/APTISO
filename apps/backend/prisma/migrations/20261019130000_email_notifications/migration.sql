-- Notification e-mails on or off (profile page); the bell in the app is always on.
ALTER TABLE "users" ADD COLUMN "email_notifications" BOOLEAN NOT NULL DEFAULT true;
