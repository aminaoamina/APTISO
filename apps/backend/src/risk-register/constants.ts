/**
 * Risk scales, exactly as defined in the Risk Assessment and Treatment
 * Methodology (P2S1, section 3.1.4 and 3.1.5). The register must produce
 * results consistent with that document (ISO/IEC 27001 clause 6.1.2 b),
 * so any change here must be mirrored in risk-methodology.template.ts.
 */
export const RISK_SCALE = {
  MIN_VALUE: 0,
  MAX_VALUE: 2,
  /** Levels 0, 1 and 2 are acceptable; 3 and 4 must be treated. */
  MAX_ACCEPTABLE_LEVEL: 2,
  VALUE_LABELS: { 0: 'Low', 1: 'Moderate', 2: 'High' } as Record<number, string>,
};

export const riskLevel = (impact: number, likelihood: number) => impact + likelihood;

export const isAcceptableLevel = (level: number) => level <= RISK_SCALE.MAX_ACCEPTABLE_LEVEL;

export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  INFRASTRUCTURE: 'Infrastructure',
  IT_COMMUNICATION: 'IT and communication equipment',
  SOFTWARE_DATABASE: 'Software & databases',
  DOCUMENTS_DATA: 'Other documents and data',
  HUMAN_RESOURCES: 'Human resources',
  THIRD_PARTY: 'Third-party services',
};

export interface AssetCatalogEntry {
  name: string;
  category: string;
}

export const ASSET_CATALOG: AssetCatalogEntry[] = [
  // Infrastructure
  { name: 'Office rooms / facilities', category: 'INFRASTRUCTURE' },
  { name: 'Production facilities', category: 'INFRASTRUCTURE' },
  { name: 'Cabling (e.g., electrical, grounding etc.)', category: 'INFRASTRUCTURE' },
  { name: 'Near building environment (e.g., parking lots, access roads, etc.)', category: 'INFRASTRUCTURE' },
  { name: 'Basic services (e.g., electricity, water, sewer, HVAC, air-conditioning, fire suppression, etc.)', category: 'INFRASTRUCTURE' },
  { name: 'Server room or datacenter', category: 'INFRASTRUCTURE' },
  { name: 'Remote workspace', category: 'INFRASTRUCTURE' },
  { name: 'Archives', category: 'INFRASTRUCTURE' },
  { name: 'Warehouses', category: 'INFRASTRUCTURE' },
  { name: 'Safes', category: 'INFRASTRUCTURE' },
  { name: 'Cabinets', category: 'INFRASTRUCTURE' },
  { name: 'Uninterruptible power supply (UPS) devices', category: 'INFRASTRUCTURE' },
  { name: 'Power generators', category: 'INFRASTRUCTURE' },
  { name: 'Vehicles', category: 'INFRASTRUCTURE' },
  { name: 'Keys', category: 'INFRASTRUCTURE' },
  { name: 'Alarm systems', category: 'INFRASTRUCTURE' },
  { name: 'CCTV / surveillance cameras', category: 'INFRASTRUCTURE' },
  { name: 'Cards and card readers', category: 'INFRASTRUCTURE' },
  // IT and communication equipment
  { name: 'Servers', category: 'IT_COMMUNICATION' },
  { name: 'IT cabling (e.g., coaxial, fiber, ethernet, etc.)', category: 'IT_COMMUNICATION' },
  { name: 'Desktop computers', category: 'IT_COMMUNICATION' },
  { name: 'Mobile devices (e.g., laptops, notebooks, tablets, smartphones, PDAs)', category: 'IT_COMMUNICATION' },
  { name: 'Network equipment (e.g., firewalls, routers and switches)', category: 'IT_COMMUNICATION' },
  { name: 'Printers, faxes, scanners, photocopiers and other peripherals', category: 'IT_COMMUNICATION' },
  { name: 'Storage media', category: 'IT_COMMUNICATION' },
  { name: 'Wireless LAN (includes wi-fi and/or bluetooth, routers, adapters, access points, etc.)', category: 'IT_COMMUNICATION' },
  { name: 'Wireless WAN (includes WAN assets plus wi-fi and/or bluetooth, routers, adapters, access points, etc.)', category: 'IT_COMMUNICATION' },
  { name: 'Desktop phones', category: 'IT_COMMUNICATION' },
  { name: 'Measuring equipment', category: 'IT_COMMUNICATION' },
  // Software & databases
  { name: 'Third-party off-the-shelf applications (e.g., office suite)', category: 'SOFTWARE_DATABASE' },
  { name: 'Internally developed software', category: 'SOFTWARE_DATABASE' },
  { name: 'Third-party custom made software', category: 'SOFTWARE_DATABASE' },
  { name: 'Operating systems', category: 'SOFTWARE_DATABASE' },
  { name: 'Database management systems', category: 'SOFTWARE_DATABASE' },
  { name: 'Various software tools', category: 'SOFTWARE_DATABASE' },
  { name: 'Databases', category: 'SOFTWARE_DATABASE' },
  // Other documents and data
  { name: 'Laws, regulations, contracts and agreements', category: 'DOCUMENTS_DATA' },
  { name: 'Policies, procedures, plans and work instructions', category: 'DOCUMENTS_DATA' },
  { name: 'Proprietary data', category: 'DOCUMENTS_DATA' },
  { name: 'Personal data (e.g., from employees or customers)', category: 'DOCUMENTS_DATA' },
  { name: 'Third-party data (not including personal data)', category: 'DOCUMENTS_DATA' },
  { name: 'Records and logs', category: 'DOCUMENTS_DATA' },
  { name: 'Equipment documentation', category: 'DOCUMENTS_DATA' },
  { name: 'Training documentation', category: 'DOCUMENTS_DATA' },
  // Human resources
  { name: 'Top management', category: 'HUMAN_RESOURCES' },
  { name: 'Other employees', category: 'HUMAN_RESOURCES' },
  { name: 'Visitors', category: 'HUMAN_RESOURCES' },
  { name: 'Middle management', category: 'HUMAN_RESOURCES' },
  { name: 'Employees with specific expertise (e.g., system administrators, designers, software developers, security experts, etc.)', category: 'HUMAN_RESOURCES' },
  { name: 'Remote employees', category: 'HUMAN_RESOURCES' },
  // Third-party services
  { name: 'Outsourced personnel (e.g., freelancers or contractors)', category: 'THIRD_PARTY' },
  { name: 'Third-party services used over the Internet (e.g., SaaS)', category: 'THIRD_PARTY' },
  { name: 'Power supply (electricity)', category: 'THIRD_PARTY' },
  { name: 'Communication services (voice, Internet, etc.)', category: 'THIRD_PARTY' },
  { name: 'IT equipment maintenance', category: 'THIRD_PARTY' },
  { name: 'Software and database maintenance', category: 'THIRD_PARTY' },
  { name: 'Mail and courier services', category: 'THIRD_PARTY' },
  { name: 'Legal services', category: 'THIRD_PARTY' },
  { name: 'Consultants', category: 'THIRD_PARTY' },
  { name: 'Auditors, supervisory authorities', category: 'THIRD_PARTY' },
  { name: 'Cleaning and facilities maintenance', category: 'THIRD_PARTY' },
];

export const VULNERABILITY_CATALOG: AssetCatalogEntry[] = [
  // Infrastructure
  { name: 'Lack of/inadequate maintenance', category: 'INFRASTRUCTURE' },
  { name: 'Incompatible infrastructure', category: 'INFRASTRUCTURE' },
  { name: 'Lack of access controls to facilities, rooms or offices', category: 'INFRASTRUCTURE' },
  { name: 'Inadequate infrastructure capacity', category: 'INFRASTRUCTURE' },
  { name: 'Inadequate infrastructure change control', category: 'INFRASTRUCTURE' },
  { name: 'Inadequate electrical cabling', category: 'INFRASTRUCTURE' },
  { name: 'Lack of/poor internal audit of infrastructure', category: 'INFRASTRUCTURE' },
  { name: 'Location of infrastructure sensitive to water leakage', category: 'INFRASTRUCTURE' },
  { name: 'Location of infrastructure sensitive to natural disasters', category: 'INFRASTRUCTURE' },
  { name: 'Over-dependence on one infrastructure', category: 'INFRASTRUCTURE' },
  { name: 'Rules related to infrastructure not clearly defined', category: 'INFRASTRUCTURE' },
  { name: 'Use of old infrastructure/equipment/facilities', category: 'INFRASTRUCTURE' },
  // IT & Communication
  { name: 'Inadequate/incompatible equipment', category: 'IT_COMMUNICATION' },
  { name: 'Cryptographic keys accessible to unauthorized persons', category: 'IT_COMMUNICATION' },
  { name: 'Disposal of storage media without erasing data', category: 'IT_COMMUNICATION' },
  { name: 'Inadequate capacity of IT/communication equipment', category: 'IT_COMMUNICATION' },
  { name: 'Inadequate change control of IT/communication equipment', category: 'IT_COMMUNICATION' },
  { name: 'Inadequate IT cabling', category: 'IT_COMMUNICATION' },
  { name: 'Inadequate maintenance of IT/communication equipment', category: 'IT_COMMUNICATION' },
  { name: 'Inadequate network management', category: 'IT_COMMUNICATION' },
  { name: 'Lack of/poor internal audit of IT/communication equipment', category: 'IT_COMMUNICATION' },
  { name: 'Mobile equipment improperly attended', category: 'IT_COMMUNICATION' },
  { name: 'Mobile equipment inadequately physically protected', category: 'IT_COMMUNICATION' },
  { name: 'Wrong configuration of network access', category: 'IT_COMMUNICATION' },
  { name: 'Network devices inadequately physically protected', category: 'IT_COMMUNICATION' },
  { name: 'Test and operational environment are not separated', category: 'IT_COMMUNICATION' },
  { name: 'Over-dependence on one device', category: 'IT_COMMUNICATION' },
  { name: 'Sensitivity of equipment to humidity and pollution', category: 'IT_COMMUNICATION' },
  { name: 'Sensitivity of equipment to temperature', category: 'IT_COMMUNICATION' },
  { name: 'Sensitivity of equipment to voltage change', category: 'IT_COMMUNICATION' },
  { name: 'Rules for IT/communication equipment not clearly defined', category: 'IT_COMMUNICATION' },
  { name: 'Downloads from Internet not controlled', category: 'IT_COMMUNICATION' },
  { name: 'Use of old IT/communication equipment', category: 'IT_COMMUNICATION' },
  { name: 'Lack of alternative power supply', category: 'IT_COMMUNICATION' },
  // Software & Database
  { name: 'Software design flaw', category: 'SOFTWARE_DATABASE' },
  { name: 'Software misconfiguration', category: 'SOFTWARE_DATABASE' },
  { name: 'Software components not compatible', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of/not updated anti-virus software', category: 'SOFTWARE_DATABASE' },
  { name: 'Sessions are left active after working hours', category: 'SOFTWARE_DATABASE' },
  { name: 'Complicated user interface', category: 'SOFTWARE_DATABASE' },
  { name: 'Access rights are granted beyond what is necessary', category: 'SOFTWARE_DATABASE' },
  { name: 'Inadequate change control of software and its databases', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of evidence of sent or received messages', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of input and output data control', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of validation for processed data', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of/poor internal audit of software and its databases', category: 'SOFTWARE_DATABASE' },
  { name: 'No deactivation of user accounts after termination of employment', category: 'SOFTWARE_DATABASE' },
  { name: 'Over-dependence on one system', category: 'SOFTWARE_DATABASE' },
  { name: 'System-generated passwords remain unchanged', category: 'SOFTWARE_DATABASE' },
  { name: 'Systems unprotected from unauthorized access', category: 'SOFTWARE_DATABASE' },
  { name: 'Requirements for software development not clearly defined', category: 'SOFTWARE_DATABASE' },
  { name: 'Rules on how to handle third parties not clearly defined', category: 'SOFTWARE_DATABASE' },
  { name: 'Lack of information about who uses information systems', category: 'SOFTWARE_DATABASE' },
  { name: 'Undocumented software', category: 'SOFTWARE_DATABASE' },
  { name: 'Weak passwords', category: 'SOFTWARE_DATABASE' },
  { name: 'Backup does not exist or is not regularly performed', category: 'SOFTWARE_DATABASE' },
  // Documents & Data
  { name: 'Inadequate change control of documents and data', category: 'DOCUMENTS_DATA' },
  { name: 'Wrong understanding about the sensitivity of information', category: 'DOCUMENTS_DATA' },
  { name: 'Inadequate physical protection of documents', category: 'DOCUMENTS_DATA' },
  { name: 'Lack of / poor internal audit of documents and data', category: 'DOCUMENTS_DATA' },
  { name: 'Poor selection of test data', category: 'DOCUMENTS_DATA' },
  { name: 'Single copy/only one copy of information available', category: 'DOCUMENTS_DATA' },
  { name: 'Confidentiality level not clearly defined', category: 'DOCUMENTS_DATA' },
  { name: 'Rules on document control not clearly defined', category: 'DOCUMENTS_DATA' },
  { name: 'Uncontrolled copying of documents and data', category: 'DOCUMENTS_DATA' },
  // Human Resources
  { name: 'Inadequate level of knowledge and/or awareness', category: 'HUMAN_RESOURCES' },
  { name: 'Inadequate segregation of duties', category: 'HUMAN_RESOURCES' },
  { name: 'Inadequate supervision of the work', category: 'HUMAN_RESOURCES' },
  { name: 'Lack of / poor internal audit of human resources', category: 'HUMAN_RESOURCES' },
  { name: 'Rules for working off-premises not clearly defined', category: 'HUMAN_RESOURCES' },
  { name: 'Rules on how to handle information not clearly defined', category: 'HUMAN_RESOURCES' },
  { name: 'Unmotivated or disgruntled employees', category: 'HUMAN_RESOURCES' },
  { name: 'Replacement person does not exist/is inadequate', category: 'HUMAN_RESOURCES' },
  // Third Party
  { name: 'Rules on how to handle third parties not clearly defined', category: 'THIRD_PARTY' },
  { name: 'Incompatible infrastructure or equipment', category: 'THIRD_PARTY' },
  { name: 'Inadequate supervision of external suppliers', category: 'THIRD_PARTY' },
  { name: 'Lack of control on where third-party stores information', category: 'THIRD_PARTY' },
  { name: 'Lack of formal agreements', category: 'THIRD_PARTY' },
  { name: 'Third party does not have adequate access control', category: 'THIRD_PARTY' },
  { name: 'Third-party is inadequately prepared for disruptions', category: 'THIRD_PARTY' },
  { name: 'It is not certain if third-party will sustain their business operations', category: 'THIRD_PARTY' },
  { name: 'Third-party business strategy change', category: 'THIRD_PARTY' },
  { name: 'Lack of or poor audit implementation of third-party services', category: 'THIRD_PARTY' },
  { name: 'Over-dependence on a supplier/partner', category: 'THIRD_PARTY' },
  { name: 'Assets remain with suppliers/partners after end of relationship', category: 'THIRD_PARTY' },
];

// Conformio's threat catalogue and the suggestion maps live in catalog-suggestions.ts.
export { THREAT_CATALOG } from './catalog-suggestions';
