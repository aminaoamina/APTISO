/** Phase 4 (Preparation for External Audit) step keys. */
export const P4 = {
  NC_PROCEDURE: 'iso27001.p4s1.nonconformity-procedure',
  AUDIT_PROCEDURE: 'iso27001.p4s2.internal-audit-procedure',
  TRAINING_PLAN: 'iso27001.p4s3.training-plan',
  OBJECTIVES: 'iso27001.p4s4.security-objectives',
  REVIEW_SETUP: 'iso27001.p4s5.management-review-setup',
  INTERNAL_AUDIT: 'iso27001.p4s6.internal-audit',
  MANAGEMENT_REVIEW: 'iso27001.p4s7.management-review',
} as const;

export const RISK_REGISTER_KEY = 'iso27001.p2s2.risk-register';
export const SOA_KEY = 'iso27001.p2s3.statement-of-applicability';
export const REQUIREMENTS_KEY = 'iso27001.p1s5.legal-requirements';

export const FREQUENCY_MONTHS = { MONTHLY: 1, QUARTERLY: 3, SEMI_ANNUALLY: 6, YEARLY: 12 } as const;
export const FREQUENCY_LABELS = { MONTHLY: 'Every month', QUARTERLY: 'Every quarter', SEMI_ANNUALLY: 'Every 6 months', YEARLY: 'Every year' } as const;

export type Checklist = { ready: boolean; items: { key: string; label: string; done: boolean; detail: string }[] };
export const checklist = (items: Checklist['items']): Checklist => ({ ready: items.every(i => i.done), items });
