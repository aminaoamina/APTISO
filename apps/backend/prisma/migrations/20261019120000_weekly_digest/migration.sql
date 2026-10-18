-- Weekly digest e-mail (on by default, turned off from the profile page).
ALTER TABLE "users" ADD COLUMN "weekly_digest" BOOLEAN NOT NULL DEFAULT true;
