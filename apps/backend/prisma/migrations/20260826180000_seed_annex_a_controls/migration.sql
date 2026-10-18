-- ============================================================
-- Seed: ISO/IEC 27001:2022 Annex A controls (93 controls)
--
-- Groups:
--   A.5 Organizational controls  (37)
--   A.6 People controls          (8)
--   A.7 Physical controls        (14)
--   A.8 Technological controls   (34)
--
-- Replaces the earlier seed_controls.sql, which was never executed and
-- contained 102 rows: 6 incorrect A.6 entries (risk-clause text rather
-- than People controls) and 11 fabricated A.9/A.17 entries that do not
-- exist in the 2022 revision of the standard.
--
-- Idempotent: safe to re-run.
-- ============================================================

INSERT INTO "risk_controls" ("id", "code", "title") VALUES
  (gen_random_uuid(), 'A.5.1',  'Policies for information security'),
  (gen_random_uuid(), 'A.5.2',  'Information security roles and responsibilities'),
  (gen_random_uuid(), 'A.5.3',  'Segregation of duties'),
  (gen_random_uuid(), 'A.5.4',  'Management responsibilities'),
  (gen_random_uuid(), 'A.5.5',  'Contact with authorities'),
  (gen_random_uuid(), 'A.5.6',  'Contact with special interest groups'),
  (gen_random_uuid(), 'A.5.7',  'Threat intelligence'),
  (gen_random_uuid(), 'A.5.8',  'Information security in project management'),
  (gen_random_uuid(), 'A.5.9',  'Inventory of information and other associated assets'),
  (gen_random_uuid(), 'A.5.10', 'Acceptable use of information and other associated assets'),
  (gen_random_uuid(), 'A.5.11', 'Return of assets'),
  (gen_random_uuid(), 'A.5.12', 'Classification of information'),
  (gen_random_uuid(), 'A.5.13', 'Labelling of information'),
  (gen_random_uuid(), 'A.5.14', 'Information transfer'),
  (gen_random_uuid(), 'A.5.15', 'Access control'),
  (gen_random_uuid(), 'A.5.16', 'Identity management'),
  (gen_random_uuid(), 'A.5.17', 'Authentication information'),
  (gen_random_uuid(), 'A.5.18', 'Access rights'),
  (gen_random_uuid(), 'A.5.19', 'Information security in supplier relationships'),
  (gen_random_uuid(), 'A.5.20', 'Addressing information security within supplier agreements'),
  (gen_random_uuid(), 'A.5.21', 'Managing information security in the ICT supply chain'),
  (gen_random_uuid(), 'A.5.22', 'Monitoring, review and change management of supplier services'),
  (gen_random_uuid(), 'A.5.23', 'Information security for use of cloud services'),
  (gen_random_uuid(), 'A.5.24', 'Information security incident management planning and preparation'),
  (gen_random_uuid(), 'A.5.25', 'Assessment and decision on information security events'),
  (gen_random_uuid(), 'A.5.26', 'Response to information security incidents'),
  (gen_random_uuid(), 'A.5.27', 'Learning from information security incidents'),
  (gen_random_uuid(), 'A.5.28', 'Collection of evidence'),
  (gen_random_uuid(), 'A.5.29', 'Information security during disruption'),
  (gen_random_uuid(), 'A.5.30', 'ICT readiness for business continuity'),
  (gen_random_uuid(), 'A.5.31', 'Legal, statutory, regulatory and contractual requirements'),
  (gen_random_uuid(), 'A.5.32', 'Intellectual property rights'),
  (gen_random_uuid(), 'A.5.33', 'Protection of records'),
  (gen_random_uuid(), 'A.5.34', 'Privacy and protection of PII'),
  (gen_random_uuid(), 'A.5.35', 'Independent review of information security'),
  (gen_random_uuid(), 'A.5.36', 'Compliance with policies, rules and standards for information security'),
  (gen_random_uuid(), 'A.5.37', 'Documented operating procedures'),
  (gen_random_uuid(), 'A.6.1',  'Screening'),
  (gen_random_uuid(), 'A.6.2',  'Terms and conditions of employment'),
  (gen_random_uuid(), 'A.6.3',  'Information security awareness, education and training'),
  (gen_random_uuid(), 'A.6.4',  'Disciplinary process'),
  (gen_random_uuid(), 'A.6.5',  'Responsibilities after termination or change of employment'),
  (gen_random_uuid(), 'A.6.6',  'Confidentiality or non-disclosure agreements'),
  (gen_random_uuid(), 'A.6.7',  'Remote working'),
  (gen_random_uuid(), 'A.6.8',  'Information security event reporting'),
  (gen_random_uuid(), 'A.7.1',  'Physical security perimeter'),
  (gen_random_uuid(), 'A.7.2',  'Physical entry'),
  (gen_random_uuid(), 'A.7.3',  'Security of offices, rooms and facilities'),
  (gen_random_uuid(), 'A.7.4',  'Physical security monitoring'),
  (gen_random_uuid(), 'A.7.5',  'Protection against physical and environmental threats'),
  (gen_random_uuid(), 'A.7.6',  'Working in secure areas'),
  (gen_random_uuid(), 'A.7.7',  'Clear desk and clear screen'),
  (gen_random_uuid(), 'A.7.8',  'Equipment siting and protection'),
  (gen_random_uuid(), 'A.7.9',  'Security of assets off-premises'),
  (gen_random_uuid(), 'A.7.10', 'Storage media'),
  (gen_random_uuid(), 'A.7.11', 'Supporting utilities'),
  (gen_random_uuid(), 'A.7.12', 'Cabling security'),
  (gen_random_uuid(), 'A.7.13', 'Equipment maintenance'),
  (gen_random_uuid(), 'A.7.14', 'Secure disposal or re-use of equipment'),
  (gen_random_uuid(), 'A.8.1',  'User endpoint devices'),
  (gen_random_uuid(), 'A.8.2',  'Privileged access rights'),
  (gen_random_uuid(), 'A.8.3',  'Information access restriction'),
  (gen_random_uuid(), 'A.8.4',  'Access to source code'),
  (gen_random_uuid(), 'A.8.5',  'Secure authentication'),
  (gen_random_uuid(), 'A.8.6',  'Capacity management'),
  (gen_random_uuid(), 'A.8.7',  'Protection against malware'),
  (gen_random_uuid(), 'A.8.8',  'Management of technical vulnerabilities'),
  (gen_random_uuid(), 'A.8.9',  'Configuration management'),
  (gen_random_uuid(), 'A.8.10', 'Information deletion'),
  (gen_random_uuid(), 'A.8.11', 'Data masking'),
  (gen_random_uuid(), 'A.8.12', 'Prevention of data leakage'),
  (gen_random_uuid(), 'A.8.13', 'Information backup'),
  (gen_random_uuid(), 'A.8.14', 'Redundancy of information processing facilities'),
  (gen_random_uuid(), 'A.8.15', 'Logging'),
  (gen_random_uuid(), 'A.8.16', 'Monitoring activities'),
  (gen_random_uuid(), 'A.8.17', 'Clock synchronization'),
  (gen_random_uuid(), 'A.8.18', 'Use of privileged utility programs'),
  (gen_random_uuid(), 'A.8.19', 'Installation of software on operational systems'),
  (gen_random_uuid(), 'A.8.20', 'Networks security'),
  (gen_random_uuid(), 'A.8.21', 'Security of network services'),
  (gen_random_uuid(), 'A.8.22', 'Segregation of networks'),
  (gen_random_uuid(), 'A.8.23', 'Web filtering'),
  (gen_random_uuid(), 'A.8.24', 'Use of cryptography'),
  (gen_random_uuid(), 'A.8.25', 'Secure development lifecycle'),
  (gen_random_uuid(), 'A.8.26', 'Application security requirements'),
  (gen_random_uuid(), 'A.8.27', 'Secure system architecture and engineering principles'),
  (gen_random_uuid(), 'A.8.28', 'Secure coding'),
  (gen_random_uuid(), 'A.8.29', 'Security testing in development and acceptance'),
  (gen_random_uuid(), 'A.8.30', 'Outsourced development'),
  (gen_random_uuid(), 'A.8.31', 'Separation of development, test and production environments'),
  (gen_random_uuid(), 'A.8.32', 'Change management'),
  (gen_random_uuid(), 'A.8.33', 'Test information'),
  (gen_random_uuid(), 'A.8.34', 'Protection of information systems during audit testing')
ON CONFLICT ("code") DO UPDATE SET "title" = EXCLUDED."title";

-- Remove controls from the superseded 2013 numbering, if a previous
-- seed introduced them. Guarded so it cannot orphan linked risk data.
DELETE FROM "risk_controls"
WHERE "code" ~ '^A\.(9|1[0-8])\.'
  AND NOT EXISTS (
    SELECT 1 FROM "risk_item_controls" ric
    WHERE ric."control_id" = "risk_controls"."id"
  );
