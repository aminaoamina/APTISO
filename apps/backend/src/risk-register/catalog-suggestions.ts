/**
 * Suggestion maps for the risk register wizard (Conformio behaviour):
 *  - threats suggested for each vulnerability (Threats stage),
 *  - threats suggested for each asset category (shown under every vulnerability),
 *  - Annex A (ISO/IEC 27001:2022) controls suggested for each vulnerability and
 *    threat (Treatment stage, option "Decrease the risk using safeguards").
 *
 * Every name must match VULNERABILITY_CATALOG / THREAT_CATALOG exactly and every
 * code must be an ISO/IEC 27001:2022 Annex A control; assertCatalogConsistency()
 * checks this when the backend starts.
 */

// Threat names, kept as constants so typos fail at compile time.
const T = {
  illness: 'Unavailability because of illness or other health problems',
  fire: 'Fire',
  flood: 'Flood',
  naturalDisaster: 'Other disasters (natural)',
  pollution: 'Pollution',
  lightning: 'Lightning strike',
  earthquake: 'Earthquake',
  powerOutage: 'Interruption of power supply from public network',
  storm: 'Storm',
  industrialAccident: 'Industrial accident',
  commsInterruption: 'Interruption of communication services',
  supplierInterruption: 'Errors or interruption of service of third-party providers',
  contractBreach: 'Breach of contracts or agreements',
  lawBreach: 'Breach of laws or regulations',
  improperUse: 'Improper use of IT systems or information',
  authMishandling: 'Inappropriate handling of authentication information (e.g. passwords)',
  unintentionalDataChange: 'Unintentional change of data in an information system',
  maintenanceErrors: 'Maintenance errors',
  unintentionalSystemAccess: 'Unintentional access to information system',
  unintentionalPhysicalAccess: 'Unintentional access to physical data',
  unintentionalRecordChange: 'Unintentional change of records',
  unintentionalInstall: 'Unintentional installation of software',
  unintentionalNetworkAccess: 'Unintentional access to network',
  unintentionalLicensed: 'Unintentional use of licensed materials',
  unintentionalUntestedCode: 'Unintentional use of untested or prohibited code',
  userError: 'Unintentional user error',
  pentestDamage: 'Unintentional damage incurred during penetration testing',
  equipmentDestruction: 'Manipulation or destruction of equipment',
  softwareMisuse: 'Unauthorized use, manipulation or destruction of software',
  unauthorizedEntry: 'Unauthorized entry into facilities, rooms or offices',
  theft: 'Theft, vandalism, or sabotage',
  equipmentAccess: 'Unauthorized access to equipment, cabinets, etc.',
  malware: 'Infection with malicious software (e.g., virus, trojan, etc.)',
  nonBusinessUse: 'Use of equipment/service for non-business purpose',
  supplyChain: 'Attack through outsourced equipment/service (compromising supply chain)',
  identityConcealment: 'Concealing user identity',
  fraud: 'Embezzlement / fraud',
  eavesdropping: 'Eavesdropping',
  socialEngineering: 'Social engineering',
  espionage: 'Industrial espionage',
  auditToolMisuse: 'Misuse of audit tools',
  strike: 'Trade union strike (industrial action)',
  terrorism: 'Terrorist attack (bomb, shooting, etc.)',
  passwordDisclosure: 'Malicious disclosure of passwords',
  maliciousSystemAccess: 'Access to information system with malicious intent',
  recordFalsification: 'Change, destruction or falsification of records with malicious intent',
  maliciousInstall: 'Installation of software with malicious intent',
  maliciousNetworkAccess: 'Access to network with malicious intent',
  maliciousLicensed: 'Use of licensed materials with malicious intent',
  maliciousCode: 'Use of unauthorized or untested code with malicious intent',
  maliciousUserError: 'Malicious user error',
  tampering: 'Equipment tampering',
  dos: 'Denial of service attack',
  applicationError: 'Application error',
  linkBreakdown: 'Breakdown of communication links',
  mediaDeterioration: 'Deterioration of media',
  equipmentFailure: 'Equipment failure',
  unintentionalDisclosure: 'Unintentional disclosure of data / information',
  dataTheft: 'Data / information theft',
  maliciousLeakage: 'Malicious leakage/disclosure of information',
} as const;

type ThreatName = (typeof T)[keyof typeof T];

/**
 * Conformio's threat catalogue: the 57 threats of the "Add a threat" list plus
 * the 3 that Conformio suggests for documents and data (60 in total), each in
 * one of Conformio's five threat categories.
 */
export const THREAT_CATALOG: { name: ThreatName; category: string }[] = [
  // Force majeure & threats from the environment
  ...[
    T.illness, T.fire, T.flood, T.naturalDisaster, T.pollution, T.lightning, T.earthquake,
    T.powerOutage, T.storm, T.industrialAccident, T.commsInterruption, T.supplierInterruption, T.strike,
  ].map(name => ({ name, category: 'FORCE_MAJEURE' })),
  // Internal organizational oversight
  ...[T.contractBreach, T.lawBreach, T.improperUse, T.authMishandling, T.nonBusinessUse]
    .map(name => ({ name, category: 'INTERNAL_OVERSIGHT' })),
  // Unintentional human mistake
  ...[
    T.unintentionalDataChange, T.maintenanceErrors, T.unintentionalSystemAccess, T.unintentionalPhysicalAccess,
    T.unintentionalRecordChange, T.unintentionalInstall, T.unintentionalNetworkAccess, T.unintentionalLicensed,
    T.unintentionalUntestedCode, T.userError, T.pentestDamage, T.unintentionalDisclosure,
  ].map(name => ({ name, category: 'UNINTENTIONAL_MISTAKE' })),
  // Malicious intent
  ...[
    T.equipmentDestruction, T.softwareMisuse, T.unauthorizedEntry, T.theft, T.equipmentAccess, T.malware,
    T.supplyChain, T.identityConcealment, T.fraud, T.eavesdropping, T.socialEngineering, T.espionage,
    T.auditToolMisuse, T.terrorism, T.passwordDisclosure, T.maliciousSystemAccess, T.recordFalsification,
    T.maliciousInstall, T.maliciousNetworkAccess, T.maliciousLicensed, T.maliciousCode, T.maliciousUserError,
    T.tampering, T.dos, T.dataTheft, T.maliciousLeakage,
  ].map(name => ({ name, category: 'MALICIOUS_INTENT' })),
  // Technical error
  ...[T.applicationError, T.linkBreakdown, T.mediaDeterioration, T.equipmentFailure]
    .map(name => ({ name, category: 'TECHNICAL_ERROR' })),
];

/** Threats Conformio lists for every asset of a category (Threats stage). */
export const CATEGORY_THREAT_SUGGESTIONS: Record<string, ThreatName[]> = {
  INFRASTRUCTURE: [T.fire, T.naturalDisaster, T.lightning, T.storm, T.industrialAccident, T.theft, T.terrorism],
  IT_COMMUNICATION: [T.commsInterruption, T.supplierInterruption, T.linkBreakdown, T.equipmentFailure],
  SOFTWARE_DATABASE: [],
  DOCUMENTS_DATA: [T.unintentionalDisclosure, T.dataTheft, T.maliciousLeakage],
  HUMAN_RESOURCES: [T.espionage],
  THIRD_PARTY: [],
};

type Suggestion = { threats: ThreatName[]; controls: string[] };

/** Threats and Annex A controls suggested for each catalogue vulnerability. */
export const VULNERABILITY_SUGGESTIONS: Record<string, Suggestion> = {
  // Infrastructure
  'Lack of/inadequate maintenance': { threats: [T.equipmentFailure, T.fire, T.maintenanceErrors], controls: ['A.7.13', 'A.7.11'] },
  'Incompatible infrastructure': { threats: [T.equipmentFailure, T.powerOutage], controls: ['A.7.8', 'A.7.11'] },
  'Lack of access controls to facilities, rooms or offices': { threats: [T.unauthorizedEntry, T.theft, T.equipmentAccess], controls: ['A.7.1', 'A.7.2', 'A.7.3'] },
  'Inadequate infrastructure capacity': { threats: [T.equipmentFailure, T.powerOutage], controls: ['A.8.6', 'A.7.11'] },
  'Inadequate infrastructure change control': { threats: [T.maintenanceErrors, T.equipmentFailure], controls: ['A.8.32', 'A.7.13'] },
  'Inadequate electrical cabling': { threats: [T.fire, T.powerOutage, T.equipmentFailure], controls: ['A.7.12', 'A.7.11'] },
  'Lack of/poor internal audit of infrastructure': { threats: [T.theft, T.unauthorizedEntry], controls: ['A.5.35', 'A.5.36', 'A.7.4'] },
  'Location of infrastructure sensitive to water leakage': { threats: [T.flood, T.equipmentFailure], controls: ['A.7.5', 'A.7.8'] },
  'Location of infrastructure sensitive to natural disasters': { threats: [T.naturalDisaster, T.earthquake, T.storm], controls: ['A.7.5', 'A.5.29', 'A.5.30'] },
  'Over-dependence on one infrastructure': { threats: [T.equipmentFailure, T.powerOutage, T.fire], controls: ['A.8.14', 'A.5.30'] },
  'Rules related to infrastructure not clearly defined': { threats: [T.unauthorizedEntry, T.improperUse], controls: ['A.5.10', 'A.7.6', 'A.5.37'] },
  'Use of old infrastructure/equipment/facilities': { threats: [T.equipmentFailure, T.fire], controls: ['A.7.13', 'A.7.14'] },

  // IT and communication equipment
  'Inadequate/incompatible equipment': { threats: [T.equipmentFailure, T.applicationError], controls: ['A.8.9', 'A.8.32'] },
  'Cryptographic keys accessible to unauthorized persons': { threats: [T.eavesdropping, T.maliciousSystemAccess, T.dataTheft], controls: ['A.8.24', 'A.5.17'] },
  'Disposal of storage media without erasing data': { threats: [T.dataTheft, T.unintentionalDisclosure], controls: ['A.7.10', 'A.7.14', 'A.8.10'] },
  'Inadequate capacity of IT/communication equipment': { threats: [T.equipmentFailure, T.dos], controls: ['A.8.6'] },
  'Inadequate change control of IT/communication equipment': { threats: [T.maintenanceErrors, T.equipmentFailure, T.unintentionalDataChange], controls: ['A.8.32', 'A.8.9'] },
  'Inadequate IT cabling': { threats: [T.linkBreakdown, T.eavesdropping], controls: ['A.7.12'] },
  'Inadequate maintenance of IT/communication equipment': { threats: [T.equipmentFailure, T.maintenanceErrors], controls: ['A.7.13'] },
  'Inadequate network management': { threats: [T.maliciousNetworkAccess, T.dos, T.linkBreakdown], controls: ['A.8.20', 'A.8.21', 'A.8.22'] },
  'Lack of/poor internal audit of IT/communication equipment': { threats: [T.improperUse, T.tampering], controls: ['A.5.35', 'A.5.36', 'A.8.34'] },
  'Mobile equipment improperly attended': { threats: [T.theft, T.unintentionalDisclosure], controls: ['A.8.1', 'A.7.9', 'A.6.7'] },
  'Mobile equipment inadequately physically protected': { threats: [T.theft, T.equipmentFailure], controls: ['A.7.9', 'A.8.1'] },
  'Wrong configuration of network access': { threats: [T.maliciousNetworkAccess, T.unintentionalNetworkAccess], controls: ['A.8.20', 'A.8.9', 'A.5.15'] },
  'Network devices inadequately physically protected': { threats: [T.tampering, T.theft], controls: ['A.7.8', 'A.7.3'] },
  'Test and operational environment are not separated': { threats: [T.unintentionalDataChange, T.unintentionalUntestedCode], controls: ['A.8.31', 'A.8.33'] },
  'Over-dependence on one device': { threats: [T.equipmentFailure], controls: ['A.8.14', 'A.8.13'] },
  'Sensitivity of equipment to humidity and pollution': { threats: [T.pollution, T.equipmentFailure], controls: ['A.7.5', 'A.7.8'] },
  'Sensitivity of equipment to temperature': { threats: [T.equipmentFailure, T.fire], controls: ['A.7.5', 'A.7.11'] },
  'Sensitivity of equipment to voltage change': { threats: [T.powerOutage, T.lightning, T.equipmentFailure], controls: ['A.7.11', 'A.7.5'] },
  'Rules for IT/communication equipment not clearly defined': { threats: [T.improperUse, T.nonBusinessUse], controls: ['A.5.10', 'A.8.1'] },
  'Downloads from Internet not controlled': { threats: [T.malware, T.unintentionalInstall], controls: ['A.8.23', 'A.8.7', 'A.8.19'] },
  'Use of old IT/communication equipment': { threats: [T.equipmentFailure, T.mediaDeterioration], controls: ['A.7.13', 'A.8.8'] },
  'Lack of alternative power supply': { threats: [T.powerOutage, T.equipmentFailure], controls: ['A.7.11', 'A.8.14'] },

  // Software & databases
  'Software design flaw': { threats: [T.applicationError, T.maliciousSystemAccess], controls: ['A.8.25', 'A.8.26', 'A.8.27'] },
  'Software misconfiguration': { threats: [T.applicationError, T.maliciousSystemAccess], controls: ['A.8.9', 'A.8.8'] },
  'Software components not compatible': { threats: [T.applicationError], controls: ['A.8.32', 'A.8.29'] },
  'Lack of/not updated anti-virus software': { threats: [T.malware, T.maliciousInstall], controls: ['A.8.7', 'A.8.8'] },
  'Sessions are left active after working hours': { threats: [T.maliciousSystemAccess, T.unintentionalSystemAccess], controls: ['A.7.7', 'A.8.5'] },
  'Complicated user interface': { threats: [T.userError, T.unintentionalDataChange], controls: ['A.8.26', 'A.6.3'] },
  'Access rights are granted beyond what is necessary': { threats: [T.maliciousSystemAccess, T.unintentionalSystemAccess, T.improperUse], controls: ['A.5.15', 'A.5.18', 'A.8.2', 'A.8.3'] },
  'Inadequate change control of software and its databases': { threats: [T.unintentionalDataChange, T.applicationError], controls: ['A.8.32', 'A.8.9'] },
  'Lack of evidence of sent or received messages': { threats: [T.identityConcealment, T.contractBreach], controls: ['A.5.14', 'A.8.15'] },
  'Lack of input and output data control': { threats: [T.unintentionalDataChange, T.recordFalsification], controls: ['A.8.26', 'A.8.28'] },
  'Lack of validation for processed data': { threats: [T.unintentionalDataChange, T.applicationError], controls: ['A.8.26', 'A.8.28', 'A.8.29'] },
  'Lack of/poor internal audit of software and its databases': { threats: [T.improperUse, T.fraud], controls: ['A.5.35', 'A.8.15', 'A.8.34'] },
  'No deactivation of user accounts after termination of employment': { threats: [T.maliciousSystemAccess, T.identityConcealment], controls: ['A.5.18', 'A.6.5', 'A.5.16'] },
  'Over-dependence on one system': { threats: [T.applicationError, T.equipmentFailure], controls: ['A.8.14', 'A.5.30'] },
  'System-generated passwords remain unchanged': { threats: [T.maliciousSystemAccess, T.authMishandling], controls: ['A.5.17', 'A.8.5'] },
  'Systems unprotected from unauthorized access': { threats: [T.maliciousSystemAccess, T.maliciousNetworkAccess, T.dataTheft], controls: ['A.8.5', 'A.8.3', 'A.8.20', 'A.5.15'] },
  'Requirements for software development not clearly defined': { threats: [T.applicationError, T.unintentionalUntestedCode], controls: ['A.8.25', 'A.8.26', 'A.8.30'] },
  // Listed under both Software & databases and Third-party services.
  'Rules on how to handle third parties not clearly defined': { threats: [T.supplyChain, T.contractBreach, T.supplierInterruption], controls: ['A.5.19', 'A.5.20', 'A.5.21'] },
  'Lack of information about who uses information systems': { threats: [T.identityConcealment, T.improperUse], controls: ['A.5.16', 'A.8.15', 'A.5.9'] },
  'Undocumented software': { threats: [T.applicationError, T.maintenanceErrors], controls: ['A.5.37', 'A.8.9'] },
  'Weak passwords': { threats: [T.maliciousSystemAccess, T.passwordDisclosure, T.socialEngineering], controls: ['A.5.17', 'A.8.5'] },
  'Backup does not exist or is not regularly performed': { threats: [T.equipmentFailure, T.malware, T.unintentionalDataChange], controls: ['A.8.13'] },

  // Other documents and data
  'Inadequate change control of documents and data': { threats: [T.unintentionalRecordChange, T.recordFalsification], controls: ['A.5.33', 'A.8.32'] },
  'Wrong understanding about the sensitivity of information': { threats: [T.unintentionalDisclosure], controls: ['A.5.12', 'A.5.13', 'A.6.3'] },
  'Inadequate physical protection of documents': { threats: [T.dataTheft, T.fire, T.unintentionalPhysicalAccess], controls: ['A.7.7', 'A.7.3', 'A.5.33'] },
  'Lack of / poor internal audit of documents and data': { threats: [T.unintentionalRecordChange, T.fraud], controls: ['A.5.35', 'A.5.36'] },
  'Poor selection of test data': { threats: [T.unintentionalDisclosure], controls: ['A.8.33', 'A.8.11'] },
  'Single copy/only one copy of information available': { threats: [T.fire, T.equipmentFailure, T.unintentionalRecordChange], controls: ['A.8.13', 'A.5.33'] },
  'Confidentiality level not clearly defined': { threats: [T.unintentionalDisclosure, T.maliciousLeakage], controls: ['A.5.12', 'A.5.13'] },
  'Rules on document control not clearly defined': { threats: [T.unintentionalRecordChange, T.unintentionalDisclosure], controls: ['A.5.37', 'A.5.33'] },
  'Uncontrolled copying of documents and data': { threats: [T.dataTheft, T.maliciousLeakage], controls: ['A.8.12', 'A.5.14', 'A.5.10'] },

  // Human resources
  'Inadequate level of knowledge and/or awareness': { threats: [T.userError, T.socialEngineering, T.malware], controls: ['A.6.3'] },
  'Inadequate segregation of duties': { threats: [T.fraud, T.recordFalsification], controls: ['A.5.3'] },
  'Inadequate supervision of the work': { threats: [T.improperUse, T.userError], controls: ['A.5.4', 'A.8.16'] },
  'Lack of / poor internal audit of human resources': { threats: [T.fraud, T.improperUse], controls: ['A.5.35', 'A.6.1'] },
  'Rules for working off-premises not clearly defined': { threats: [T.theft, T.unintentionalDisclosure], controls: ['A.6.7', 'A.7.9'] },
  'Rules on how to handle information not clearly defined': { threats: [T.unintentionalDisclosure, T.improperUse], controls: ['A.5.10', 'A.5.12', 'A.5.14'] },
  'Unmotivated or disgruntled employees': { threats: [T.maliciousLeakage, T.theft, T.maliciousUserError], controls: ['A.6.1', 'A.6.2', 'A.6.4'] },
  'Replacement person does not exist/is inadequate': { threats: [T.illness, T.strike], controls: ['A.5.2', 'A.5.30'] },

  // Third-party services
  'Incompatible infrastructure or equipment': { threats: [T.supplierInterruption, T.equipmentFailure], controls: ['A.5.20', 'A.5.22'] },
  'Inadequate supervision of external suppliers': { threats: [T.supplierInterruption, T.contractBreach], controls: ['A.5.22'] },
  'Lack of control on where third-party stores information': { threats: [T.dataTheft, T.lawBreach], controls: ['A.5.23', 'A.5.34', 'A.5.20'] },
  'Lack of formal agreements': { threats: [T.contractBreach, T.maliciousLeakage], controls: ['A.5.20', 'A.6.6'] },
  'Third party does not have adequate access control': { threats: [T.maliciousSystemAccess, T.supplyChain], controls: ['A.5.19', 'A.5.20', 'A.5.21'] },
  'Third-party is inadequately prepared for disruptions': { threats: [T.supplierInterruption, T.commsInterruption], controls: ['A.5.30', 'A.5.22'] },
  'It is not certain if third-party will sustain their business operations': { threats: [T.supplierInterruption], controls: ['A.5.19', 'A.5.22'] },
  'Third-party business strategy change': { threats: [T.supplierInterruption, T.contractBreach], controls: ['A.5.22'] },
  'Lack of or poor audit implementation of third-party services': { threats: [T.supplierInterruption, T.contractBreach], controls: ['A.5.22', 'A.5.35'] },
  'Over-dependence on a supplier/partner': { threats: [T.supplierInterruption], controls: ['A.5.19', 'A.5.30'] },
  'Assets remain with suppliers/partners after end of relationship': { threats: [T.dataTheft, T.maliciousLeakage], controls: ['A.5.11', 'A.5.20'] },
};

/** Annex A controls suggested for each catalogue threat. */
export const THREAT_CONTROL_SUGGESTIONS: Record<ThreatName, string[]> = {
  [T.illness]: ['A.5.30', 'A.5.2'],
  [T.fire]: ['A.7.5', 'A.8.13', 'A.5.30'],
  [T.flood]: ['A.7.5', 'A.8.13'],
  [T.naturalDisaster]: ['A.7.5', 'A.5.29', 'A.5.30'],
  [T.pollution]: ['A.7.5', 'A.7.8'],
  [T.lightning]: ['A.7.5', 'A.7.11'],
  [T.earthquake]: ['A.7.5', 'A.5.30'],
  [T.powerOutage]: ['A.7.11', 'A.8.14'],
  [T.storm]: ['A.7.5', 'A.5.30'],
  [T.industrialAccident]: ['A.7.5', 'A.5.29'],
  [T.commsInterruption]: ['A.8.14', 'A.5.30', 'A.8.21'],
  [T.supplierInterruption]: ['A.5.22', 'A.5.30'],
  [T.contractBreach]: ['A.5.20', 'A.5.31'],
  [T.lawBreach]: ['A.5.31', 'A.5.34'],
  [T.improperUse]: ['A.5.10', 'A.8.16'],
  [T.authMishandling]: ['A.5.17', 'A.6.3'],
  [T.unintentionalDataChange]: ['A.8.13', 'A.8.3'],
  [T.maintenanceErrors]: ['A.7.13', 'A.8.32'],
  [T.unintentionalSystemAccess]: ['A.5.15', 'A.8.3'],
  [T.unintentionalPhysicalAccess]: ['A.7.7', 'A.7.3'],
  [T.unintentionalRecordChange]: ['A.5.33', 'A.8.13'],
  [T.unintentionalInstall]: ['A.8.19'],
  [T.unintentionalNetworkAccess]: ['A.8.20', 'A.8.22'],
  [T.unintentionalLicensed]: ['A.5.32'],
  [T.unintentionalUntestedCode]: ['A.8.29', 'A.8.31'],
  [T.userError]: ['A.6.3', 'A.8.13'],
  [T.pentestDamage]: ['A.8.34'],
  [T.equipmentDestruction]: ['A.7.8', 'A.7.4'],
  [T.softwareMisuse]: ['A.8.19', 'A.8.2'],
  [T.unauthorizedEntry]: ['A.7.1', 'A.7.2', 'A.7.4'],
  [T.theft]: ['A.7.1', 'A.7.2', 'A.7.4', 'A.7.9'],
  [T.equipmentAccess]: ['A.7.3', 'A.7.8'],
  [T.malware]: ['A.8.7', 'A.8.8', 'A.8.13'],
  [T.nonBusinessUse]: ['A.5.10'],
  [T.supplyChain]: ['A.5.21', 'A.5.19'],
  [T.identityConcealment]: ['A.5.16', 'A.8.15'],
  [T.fraud]: ['A.5.3', 'A.8.15'],
  [T.eavesdropping]: ['A.8.24', 'A.8.20'],
  [T.socialEngineering]: ['A.6.3'],
  [T.espionage]: ['A.6.6', 'A.5.12', 'A.8.12'],
  [T.auditToolMisuse]: ['A.8.34', 'A.8.18'],
  [T.strike]: ['A.5.30'],
  [T.terrorism]: ['A.7.1', 'A.5.29'],
  [T.passwordDisclosure]: ['A.5.17', 'A.6.4'],
  [T.maliciousSystemAccess]: ['A.8.5', 'A.8.2', 'A.8.16'],
  [T.recordFalsification]: ['A.5.33', 'A.8.15'],
  [T.maliciousInstall]: ['A.8.19', 'A.8.7'],
  [T.maliciousNetworkAccess]: ['A.8.20', 'A.8.16'],
  [T.maliciousLicensed]: ['A.5.32'],
  [T.maliciousCode]: ['A.8.4', 'A.8.28'],
  [T.maliciousUserError]: ['A.6.4', 'A.8.15'],
  [T.tampering]: ['A.7.8', 'A.7.4'],
  [T.dos]: ['A.8.20', 'A.8.6', 'A.8.16'],
  [T.applicationError]: ['A.8.29', 'A.8.32'],
  [T.linkBreakdown]: ['A.8.14', 'A.7.12'],
  [T.mediaDeterioration]: ['A.7.10', 'A.8.13'],
  [T.equipmentFailure]: ['A.7.13', 'A.8.14', 'A.8.13'],
  [T.unintentionalDisclosure]: ['A.5.12', 'A.8.12', 'A.6.3'],
  [T.dataTheft]: ['A.8.12', 'A.5.15', 'A.7.10'],
  [T.maliciousLeakage]: ['A.8.12', 'A.6.6', 'A.6.4'],
};

/** Number of controls in each Annex A theme of ISO/IEC 27001:2022. */
const ANNEX_A_THEME_SIZES: Record<string, number> = { '5': 37, '6': 8, '7': 14, '8': 34 };

export const isAnnexAControl = (code: string) => {
  const m = /^A\.([5-8])\.(\d{1,2})$/.exec(code);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= ANNEX_A_THEME_SIZES[m[1]];
};

/** Fails fast if a suggestion refers to an unknown vulnerability, threat or control. */
export function assertCatalogConsistency(vulnerabilityNames: string[]) {
  const errors: string[] = [];
  const threatNames = new Set<string>(THREAT_CATALOG.map(t => t.name));
  const vulnNames = new Set(vulnerabilityNames);

  if (threatNames.size !== THREAT_CATALOG.length) errors.push('THREAT_CATALOG has duplicate names');
  for (const v of vulnNames) {
    if (!VULNERABILITY_SUGGESTIONS[v]) errors.push(`No suggestions for vulnerability "${v}"`);
  }
  for (const [v, s] of Object.entries(VULNERABILITY_SUGGESTIONS)) {
    if (!vulnNames.has(v)) errors.push(`Suggestions for unknown vulnerability "${v}"`);
    s.threats.forEach(t => threatNames.has(t) || errors.push(`"${v}" suggests unknown threat "${t}"`));
    s.controls.forEach(c => isAnnexAControl(c) || errors.push(`"${v}" suggests invalid control "${c}"`));
  }
  for (const t of threatNames) {
    const controls = THREAT_CONTROL_SUGGESTIONS[t as ThreatName];
    if (!controls) errors.push(`No control suggestions for threat "${t}"`);
    else controls.forEach(c => isAnnexAControl(c) || errors.push(`"${t}" suggests invalid control "${c}"`));
  }
  if (errors.length > 0) {
    throw new Error(['Risk catalogue is inconsistent:', ...errors].join('\n- '));
  }
}
