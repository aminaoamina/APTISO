/**
 * Awareness materials suggested per step (Conformio: "To make your people
 * aware of ... we suggest the following materials"). Steps listed here get the
 * Awareness and Training panels instead of the plain yes/no questions.
 *
 * Only add a url when the link has been verified; users can add their own
 * materials (title + link) in the panel.
 */
export interface AwarenessMaterial {
  kind: 'Article' | 'Video' | 'Document';
  title: string;
  url?: string;
}

export const STEP_AWARENESS_MATERIALS: Record<string, AwarenessMaterial[]> = {
  'iso27001.p2s2.risk-register': [
    {
      kind: 'Article',
      title: 'ISO 27001 Risk Assessment & Risk Treatment: The Complete Guide',
      url: 'https://advisera.com/27001academy/iso-27001-risk-assessment-treatment-management/',
    },
    { kind: 'Video', title: 'ISO 27001 Information Security Risk Assessment - Risk identification' },
    { kind: 'Video', title: 'ISO 27001 Information Security Risk Assessment - Risk analysis and evaluation' },
    { kind: 'Video', title: 'ISO 27001 Information Security Risk Treatment' },
  ],
};
