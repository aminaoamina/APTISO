/**
 * Phase 3 (Security Documentation) policy catalogue.
 *
 * Conformio: "After completing the Statement of Applicability, the necessary
 * policy and procedure documents will be automatically added as steps."
 * A policy becomes a step when at least one control it covers is applicable
 * in the SoA. The controls come from ANNEX_A (soa/annex-a.ts), so the two
 * stay consistent. Documents APTISO already produces in Phase 1 (Information
 * Security Policy, document control, legal register) are not repeated here.
 */
import { ANNEX_A, DOC } from '../soa/annex-a';

export interface PolicyDefinition {
  key: string;
  title: string;
  purpose: string;
  /** Optional extra condition on the SoA setup answers (e.g. BYOD). */
  requiresSetup?: string;
  controls: string[];
}

// Conformio's order: its IT Security Policy step first, then the hub list.
const DEFINITIONS: Omit<PolicyDefinition, 'controls'>[] = [
  { key: 'it-security-policy', title: DOC.IT_SECURITY_POLICY, purpose: 'Define clear rules for all employees for the use of information systems and other information assets.' },
  { key: 'access-control-policy', title: DOC.ACCESS_CONTROL, purpose: 'Define rules for access to information, systems and facilities, based on business and security requirements.' },
  { key: 'backup-policy', title: DOC.BACKUP, purpose: 'Ensure that backup copies of information, software and systems are made, protected and regularly tested.' },
  { key: 'byod-policy', title: DOC.BYOD, purpose: 'Define rules for using personal devices to access company information.', requiresSetup: 'personal_devices' },
  { key: 'change-management-policy', title: DOC.CHANGE_MANAGEMENT, purpose: 'Ensure that changes to information systems and processing facilities are controlled.' },
  { key: 'clear-desk-policy', title: DOC.CLEAR_DESK, purpose: 'Reduce the risk of unauthorized access to information left on desks, screens and media.' },
  { key: 'confidentiality-statement', title: DOC.CONFIDENTIALITY, purpose: 'Commit employees and external parties to keeping information confidential, during and after their engagement.' },
  { key: 'disaster-recovery-plan', title: DOC.DISASTER_RECOVERY, purpose: 'Define how information security and ICT services are maintained and restored during and after a disruption.' },
  { key: 'disposal-policy', title: DOC.DISPOSAL, purpose: 'Ensure that information and media are securely deleted or destroyed when no longer needed.' },
  { key: 'classification-policy', title: DOC.CLASSIFICATION, purpose: 'Define how information is classified, labelled and handled according to its sensitivity.' },
  { key: 'information-transfer-policy', title: DOC.INFORMATION_TRANSFER, purpose: 'Protect information transferred within the organization and with external parties.' },
  { key: 'mobile-telework-policy', title: DOC.MOBILE_TELEWORK, purpose: 'Define security rules for mobile devices, teleworking and working from home.' },
  { key: 'password-policy', title: DOC.PASSWORD, purpose: 'Define rules for creating, using and protecting passwords and other authentication information.' },
  { key: 'encryption-policy', title: DOC.ENCRYPTION, purpose: 'Define the use of cryptography and the management of cryptographic keys.' },
  { key: 'secure-areas-procedures', title: DOC.SECURE_AREAS, purpose: 'Protect premises and secure areas against unauthorized physical access, damage and interference.' },
  { key: 'secure-development-policy', title: DOC.SECURE_DEVELOPMENT, purpose: 'Define rules for the secure development of software and systems.' },
  { key: 'supplier-clauses', title: DOC.SUPPLIER_CLAUSES, purpose: 'Provide the security clauses to include in agreements with suppliers and partners.' },
  { key: 'it-procedures', title: DOC.IT_PROCEDURES, purpose: 'Define the security procedures the IT department follows to operate systems and networks securely.' },
  { key: 'system-requirements', title: DOC.SYSTEM_REQUIREMENTS, purpose: 'Define how security requirements are specified when new systems are developed or acquired.' },
  { key: 'supplier-security-policy', title: DOC.SUPPLIER_SECURITY, purpose: 'Manage information security risks in supplier relationships and cloud services.' },
  { key: 'incident-management-procedure', title: DOC.INCIDENT_MANAGEMENT, purpose: 'Ensure quick and effective detection, reporting, response and learning for information security incidents.' },
];

export const POLICY_STEP_PREFIX = 'iso27001.p3.';

export const POLICY_CATALOG: PolicyDefinition[] = DEFINITIONS.map(def => ({
  ...def,
  controls: Object.entries(ANNEX_A)
    .filter(([, entry]) => (entry.documents as string[]).includes(def.title))
    .map(([code]) => code),
}));

export const policyStepKey = (key: string) => `${POLICY_STEP_PREFIX}${key}`;

export const findPolicyByStepKey = (stepKey: string) =>
  POLICY_CATALOG.find(p => policyStepKey(p.key) === stepKey);

/** Every Phase 3 document referenced in ANNEX_A must be in the catalogue, and each must cover a control. */
export function assertPolicyCatalog() {
  const phase1 = new Set<string>([DOC.SECURITY_POLICY, DOC.DOCUMENT_CONTROL, DOC.LEGAL_REGISTER]);
  const referenced = new Set(Object.values(ANNEX_A).flatMap(e => e.documents as string[]));
  const missing = [...referenced].filter(d => !phase1.has(d) && !POLICY_CATALOG.some(p => p.title === d));
  const empty = POLICY_CATALOG.filter(p => p.controls.length === 0).map(p => p.title);
  if (missing.length || empty.length) {
    throw new Error(`Policy catalogue is inconsistent: missing ${missing.join(', ') || '-'}; no controls ${empty.join(', ') || '-'}`);
  }
}
