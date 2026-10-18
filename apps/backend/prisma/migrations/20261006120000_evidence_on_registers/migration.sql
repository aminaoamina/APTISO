-- Evidence on register records, and renewal tasks before evidence expires.
ALTER TYPE "EvidenceTargetType" ADD VALUE 'NONCONFORMITY';
ALTER TYPE "EvidenceTargetType" ADD VALUE 'INCIDENT';
ALTER TYPE "EvidenceTargetType" ADD VALUE 'TRAINING';
ALTER TYPE "EvidenceTargetType" ADD VALUE 'AUDIT_ITEM';

ALTER TYPE "TaskType" ADD VALUE 'EVIDENCE_RENEWAL';
