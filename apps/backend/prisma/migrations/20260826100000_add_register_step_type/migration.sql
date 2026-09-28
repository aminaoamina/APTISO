-- Postgres cannot use a new enum value in the same transaction that adds it,
-- so REGISTER is added here, before the migrations that insert REGISTER steps.
ALTER TYPE "StepType" ADD VALUE IF NOT EXISTS 'REGISTER';
