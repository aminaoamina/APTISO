import { findPolicyByStepKey } from '../policies/policy-catalog';
import { P4 } from '../audit-prep/keys';

/** ISO/IEC 27001 clauses (and Annex A controls) each generated document answers to. */
const BY_TEMPLATE: Record<string, string[]> = {
  'DOC-CONTROL': ['7.5'],
  'PROJECT-PLAN': ['4.4', '6.2'],
  'REQ-IDENTIFICATION': ['4.2'],
  'LEGAL-REGISTER': ['4.2', 'A.5.31'],
  'ISMS-SCOPE': ['4.3'],
  'SECURITY-POLICY': ['5.2', 'A.5.1'],
  'RISK-METHODOLOGY': ['6.1.2', '6.1.3'],
  'RISK-REPORT': ['6.1.2', '8.2'],
  SOA: ['6.1.3', '8.3'],
  'TRAINING-PLAN': ['7.2', '7.3', 'A.6.3'],
  'SECURITY-OBJECTIVES': ['6.2'],
  'INTERNAL-AUDIT-REPORT': ['9.2'],
  'INTERNAL-AUDIT-PROGRAM': ['9.2'],
  'MANAGEMENT-REVIEW-MINUTES': ['9.3'],
};

const BY_STEP: Record<string, string[]> = {
  [P4.NC_PROCEDURE]: ['10.1', '10.2'],
  [P4.AUDIT_PROCEDURE]: ['9.2'],
};

/** What a document must cover: its policy's controls (Phase 3), its procedure's clauses, or its template's clauses. */
export function coverage(stepKey: string | null, templateCode: string): string[] {
  const policy = stepKey ? findPolicyByStepKey(stepKey) : undefined;
  if (policy) return policy.controls;
  return (stepKey && BY_STEP[stepKey]) || BY_TEMPLATE[templateCode] || [];
}
