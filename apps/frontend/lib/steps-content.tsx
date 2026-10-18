'use client';

import { ReactNode } from 'react';

/**
 * Educational step content, keyed by the stable ProjectStep.key.
 * Presentation-only reference material (not user data); when steps become
 * admin-editable this moves to the database/CMS.
 */

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {title && <h3 className="font-semibold text-sm tracking-wide">{title}</h3>}
      <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function IntroToIso27001Content() {
  return (
    <div className="space-y-6">
      <Section title="Why this step matters">
        <p>
          Before any technical or documentation work begins, leadership and the project team
          need a shared understanding of what implementing ISO 27001 actually involves — how
          long it takes, who is responsible for what, and which foundational decisions have to
          be made correctly from day one. Getting this wrong (a badly set scope, no management
          buy-in, an unmanaged project) is the single most common reason ISO 27001 projects
          stall or fail.
        </p>
        <p>
          This step is educational: its goal is to align everyone on the process before the
          working steps of Phase 1 begin.
        </p>
      </Section>

      <Section title="Project timeline and workload">
        <Bullets
          items={[
            <>
              The estimated project end date is calculated from the information provided during
              setup — see the <strong className="text-foreground">Start/Target dates</strong> on
              your project dashboard.
            </>,
            <>Responsibilities can be assigned to other people at any point during the project.</>,
            <>
              One of the first deliverables is a <strong className="text-foreground">Project
              Plan</strong>, documenting the overall timeline plus roles and responsibilities.
            </>,
          ]}
        />
      </Section>

      <Section title="Foundations outside the platform's direct control">
        <p>
          The platform provides structure, templates and guidance for the items below — but the
          underlying decisions must come from your organization.
        </p>
        <div className="pl-1 space-y-4 pt-1">
          <div>
            <p className="font-medium text-foreground text-sm">1. Setting the scope</p>
            <p className="mt-1">
              The scope defines the boundaries of the Information Security Management System —
              which parts of the organization, locations and processes are covered by
              certification. Too broad, and the workload becomes unmanageable; too narrow, and
              the certification loses meaning.
            </p>
            <p className="mt-1">
              Best practice: small companies usually scope the entire organization; large or
              complex companies should limit scope to one department, location or business unit.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">2. Getting top management support</p>
            <p className="mt-1">
              Top management provides the resources the project needs: money (budget for tools,
              training and audits), manpower (people allocated from relevant departments), and
              authority (the weight to enforce decisions and remove roadblocks).
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">3. Setting up project management</p>
            <p className="mt-1">
              The project manager commits roughly 10% of full-time hours (about half a day per
              week) specifically to managing the project. The project should be broken into
              clear milestones and deadlines. A project manager does not need deep information
              security expertise — their job is leading and coordinating the structured process.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">4. Making documentation stick</p>
            <p className="mt-1">
              Documentation only has value if people actually use it. Documents should be easy
              to use for the people relying on them day to day, and developed with input from
              those affected — not written in isolation and imposed top-down.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Key roles in the project">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr className="bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground w-40">Project Manager</td>
                <td className="px-3 py-2">
                  Leads execution, manages timeline, milestones and coordination (~10% of working
                  time). Does not need ISO/security expertise — follows the guided process.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">Sponsor</td>
                <td className="px-3 py-2">
                  A member of top management, not involved in day-to-day work. Receives progress
                  reports and provides authority when the project needs a push.
                </td>
              </tr>
              <tr className="bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground">Project Team</td>
                <td className="px-3 py-2">
                  For midsize or large organizations: one representative per department within
                  the scope — not just IT/security — ensuring broader input and smoother ISMS
                  adoption.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How this fits into the overall project">
        <p>ISO 27001 implementation on APTISO covers the full lifecycle:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Project Preparation (Phase 1)</li>
          <li>Implementation phases (detailed in later steps)</li>
          <li>Certification audit</li>
          <li>Ongoing maintenance after certification</li>
        </ol>
      </Section>
    </div>
  );
}

function SecurityAwarenessContent() {
  return (
    <div className="space-y-6">
      <Section title="Why security awareness matters">
        <p>
          People are an essential part of your information security. Even with strong technical
          controls, a single phishing click, misplaced document, reused password, or accidental
          disclosure of information can create a security incident.
        </p>
        <p>
          For this reason, ISO 27001 implementation is not only about policies, technologies,
          and procedures. The people working within your organization also need to understand the
          security risks they face and the responsibilities they have.
        </p>
        <p>
          Security awareness helps personnel understand <strong className="text-foreground">what
          they need to protect, why it matters, and what they should do when something goes
          wrong</strong>.
        </p>
        <p>
          The goal is not to turn every employee into a cybersecurity specialist. The goal is to
          make secure behavior part of everyday work.
        </p>
      </Section>

      <Section title="What should security awareness achieve?">
        <p>A good awareness program should help people:</p>
        <Bullets
          items={[
            <>Understand the organization&apos;s commitment to information security.</>,
            <>Know their responsibilities under the ISMS.</>,
            <>Recognize common security threats.</>,
            <>Handle organizational and customer information appropriately.</>,
            <>Protect their accounts, devices, and credentials.</>,
            <>Recognize suspicious emails, links, attachments, and requests.</>,
            <>Know how and when to report a security incident.</>,
            <>Understand the consequences of ignoring security requirements.</>,
            <>Apply secure practices when working remotely or outside the office.</>,
          ]}
        />
        <p>
          Awareness should be <strong className="text-foreground">relevant to the person&apos;s
          role</strong>. An employee who works with customer information may need different
          awareness from a system administrator or software developer.
        </p>
      </Section>

      <Section title="What should the training cover?">
        <p>
          There is no single mandatory training course that every organization must use. The
          content should be adapted to your organization&apos;s risks, activities, technology,
          and personnel. As a starting point, your awareness program should cover the following
          areas.
        </p>

        <Section title="1. Information security fundamentals">
          <p>Personnel should understand:</p>
          <Bullets
            items={[
              <>What information security means.</>,
              <>Why information security matters to the organization.</>,
              <>Confidentiality, integrity, and availability.</>,
              <>What types of information the organization needs to protect.</>,
              <>How employees contribute to information security.</>,
            ]}
          />
          <p className="font-medium text-foreground mt-2">
            Information security is everyone&apos;s responsibility, not only the responsibility
            of the IT or security team.
          </p>
        </Section>

        <Section title="2. Information security policies">
          <p>Employees should be introduced to the policies and rules that apply to their work:</p>
          <Bullets
            items={[
              <>Information Security Policy.</>,
              <>Acceptable Use Policy.</>,
              <>Access Control Policy.</>,
              <>Password and authentication requirements.</>,
              <>Remote Working Policy.</>,
              <>Incident Management Procedure.</>,
              <>Data Protection requirements.</>,
              <>Clean Desk and Clear Screen rules.</>,
            ]}
          />
          <p>
            People should know <strong className="text-foreground">where these policies are
            located and what is expected of them</strong>.
          </p>
        </Section>

        <Section title="3. Passwords and authentication">
          <p>Personnel should understand:</p>
          <Bullets
            items={[
              <>Why strong passwords are important.</>,
              <>Why passwords should never be shared.</>,
              <>Why password reuse is dangerous.</>,
              <>How multi-factor authentication protects accounts.</>,
              <>How to recognize suspicious login requests.</>,
              <>What to do if they believe their credentials have been compromised.</>,
            ]}
          />
        </Section>

        <Section title="4. Phishing and social engineering">
          <p>
            Phishing and social engineering are among the most important topics to cover because
            attackers frequently target people rather than technical systems.
          </p>
          <p>Personnel should learn how to recognize:</p>
          <Bullets
            items={[
              <>Suspicious emails.</>,
              <>Fake login pages.</>,
              <>Malicious links.</>,
              <>Unexpected attachments.</>,
              <>Requests for passwords or sensitive information.</>,
              <>Fake payment requests.</>,
              <>Impersonation attempts.</>,
              <>Suspicious phone calls or messages.</>,
            ]}
          />
          <p className="font-medium text-foreground mt-2">
            Stop → Check → Report. Do not click, open, or respond immediately. Verify the
            request and use the organization&apos;s defined reporting process.
          </p>
        </Section>

        <Section title="5. Secure handling of information">
          <p>Personnel should understand how information must be handled throughout its lifecycle:</p>
          <Bullets
            items={[
              <>Information classification.</>,
              <>Where sensitive information may be stored.</>,
              <>How information may be shared.</>,
              <>Approved communication channels.</>,
              <>Secure file transfer.</>,
              <>Protection of printed documents.</>,
              <>Secure disposal.</>,
              <>Restrictions on using personal storage or unauthorized cloud services.</>,
            ]}
          />
        </Section>

        <Section title="6. Device and workstation security">
          <Bullets
            items={[
              <>Locking the screen when leaving a workstation.</>,
              <>Installing security updates.</>,
              <>Using approved software.</>,
              <>Not disabling security controls.</>,
              <>Protecting laptops and mobile devices.</>,
              <>Reporting lost or stolen devices.</>,
              <>Avoiding unauthorized USB devices.</>,
              <>Following the organization&apos;s endpoint security requirements.</>,
            ]}
          />
        </Section>

        <Section title="7. Remote working">
          <p>
            If employees work remotely, awareness should cover the additional risks created by
            working outside the organization&apos;s facilities:
          </p>
          <Bullets
            items={[
              <>Secure remote access and VPN usage.</>,
              <>Public Wi-Fi risks.</>,
              <>Protecting company devices.</>,
              <>Avoiding unauthorized access by other people.</>,
              <>Secure handling of documents at home.</>,
              <>Privacy in public places.</>,
              <>Reporting lost or stolen equipment.</>,
            ]}
          />
        </Section>

        <Section title="8. Security incidents">
          <p>
            Personnel need to know that they are often the first people who can detect a
            security incident. They should understand what to report, including:
          </p>
          <Bullets
            items={[
              <>Phishing attempts.</>,
              <>Lost or stolen devices.</>,
              <>Suspected malware.</>,
              <>Unauthorized access.</>,
              <>Accidental disclosure of information.</>,
              <>Compromised credentials.</>,
              <>Suspicious system behavior.</>,
              <>Physical security breaches.</>,
            ]}
          />
          <p className="font-medium text-foreground mt-2">
            Most importantly: <strong className="text-foreground">Who do I contact?</strong> The
            reporting process should be simple and clearly communicated.
          </p>
        </Section>

        <Section title="9. Malware and ransomware">
          <Bullets
            items={[
              <>How malware can enter an organization.</>,
              <>The role of malicious attachments and downloads.</>,
              <>Why software updates matter.</>,
              <>Common warning signs.</>,
              <>What to do when a device behaves unexpectedly.</>,
              <>Why employees should not attempt to hide or ignore a suspected infection.</>,
            ]}
          />
        </Section>

        <Section title="10. Physical security">
          <Bullets
            items={[
              <>Physical access controls.</>,
              <>Visitor management.</>,
              <>Protecting confidential documents.</>,
              <>Clean desk and clear screen practices.</>,
              <>Secure disposal of documents.</>,
              <>Protecting devices from theft.</>,
              <>Preventing unauthorized people from viewing sensitive information.</>,
            ]}
          />
        </Section>

        <Section title="11. Data protection and privacy">
          <Bullets
            items={[
              <>What personal information is and why it needs to be protected.</>,
              <>Who is authorized to access it.</>,
              <>How it should be shared.</>,
              <>What constitutes accidental disclosure.</>,
              <>How to report a suspected data breach.</>,
            ]}
          />
        </Section>

        <Section title="12. Artificial intelligence and new technologies">
          <Bullets
            items={[
              <>Which AI tools are approved.</>,
              <>What information may be entered into AI tools.</>,
              <>Why confidential information should not be entered into unauthorized services.</>,
              <>Risks associated with AI-generated content.</>,
              <>The importance of reviewing AI-generated information.</>,
              <>Risks of using unauthorized AI applications.</>,
            ]}
          />
        </Section>
      </Section>

      <Section title="Who should receive awareness training?">
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <tr className="bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground w-40">All personnel</td>
                <td className="px-3 py-2">
                  General security awareness: security responsibilities, passwords, phishing,
                  information handling, incident reporting, device security.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">Management</td>
                <td className="px-3 py-2">
                  Additional: information security responsibilities, business risks, ISMS
                  objectives, risk management, security responsibilities of their teams.
                </td>
              </tr>
              <tr className="bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground">IT and security</td>
                <td className="px-3 py-2">
                  More specialized training covering topics relevant to their responsibilities.
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-foreground">Developers</td>
                <td className="px-3 py-2">
                  Secure development, secrets management, dependency security, secure coding
                  practices, protection of source code.
                </td>
              </tr>
              <tr className="bg-muted/40">
                <td className="px-3 py-2 font-medium text-foreground">HR</td>
                <td className="px-3 py-2">
                  Personnel security, confidentiality, joiner/mover/leaver processes, protection
                  of employee information.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How can you deliver the training?">
        <Section title="External training">
          <p>
            Use a security awareness training provider such as Advisera or another competent
            provider. This provides ready-made training material, videos, quizzes, and completion
            tracking.
          </p>
        </Section>
        <Section title="Internal training">
          <p>
            The organization can also create and deliver its own awareness sessions — a
            presentation, workshop, short team session, onboarding session, or internal security
            campaign.
          </p>
        </Section>
        <Section title="Combination">
          <p>
            A combination is often the most practical approach. For example: <strong className="text-foreground">
            Annual online training + periodic phishing simulations + short security
            reminders</strong>.
          </p>
        </Section>
      </Section>

      <Section title="When should awareness take place?">
        <Bullets
          items={[
            <>
              <strong className="text-foreground">During ISO 27001 implementation:</strong>{' '}
              Provide initial awareness to the people involved in implementing and operating the
              ISMS.
            </>,
            <>
              <strong className="text-foreground">During onboarding:</strong> New personnel should
              receive relevant security awareness as part of joining the organization.
            </>,
            <>
              <strong className="text-foreground">Periodically:</strong> Repeat general awareness
              at an appropriate frequency, commonly at least annually.
            </>,
            <>
              <strong className="text-foreground">After major changes:</strong> New technologies,
              policy changes, new threats, or changes in responsibilities.
            </>,
            <>
              <strong className="text-foreground">After security incidents:</strong> An incident
              can reveal an awareness gap — targeted awareness should follow.
            </>,
          ]}
        />
      </Section>

      <Section title="How can you make the training effective?">
        <p>
          Simply sending employees a training link does not necessarily mean they are aware.
          Consider combining training with practical activities:
        </p>
        <div className="pl-1 space-y-4 pt-1">
          <div>
            <p className="font-medium text-foreground text-sm">Learn</p>
            <p className="mt-1">Provide the awareness content.</p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Practice</p>
            <p className="mt-1">Use examples, exercises, workshops, or phishing simulations.</p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Measure</p>
            <p className="mt-1">
              Check whether people understood — short quizzes, knowledge checks, phishing
              simulations, surveys, or completion rates.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Improve</p>
            <p className="mt-1">
              Use results to identify weaknesses and improve future awareness activities.
            </p>
          </div>
        </div>
      </Section>

      <Section title="What evidence should you keep?">
        <p>
          For ISO 27001, it is useful to demonstrate that awareness activities actually took
          place. Keep appropriate evidence such as:
        </p>
        <Bullets
          items={[
            <>Training material and training provider information.</>,
            <>Attendance and completion records.</>,
            <>Training certificates and quiz results.</>,
            <>Awareness campaign records.</>,
            <>Phishing simulation results.</>,
            <>Internal communications and records of follow-up training.</>,
          ]}
        />
        <p>
          An auditor should be able to see that awareness is <strong className="text-foreground">
          planned, delivered, monitored, and maintained</strong>.
        </p>
      </Section>

      <Section title="A simple awareness program example">
        <div className="pl-1 space-y-4">
          <div>
            <p className="font-medium text-foreground text-sm">At onboarding</p>
            <p className="mt-1">
              A new employee receives a short security awareness session covering: Information
              Security Policy, passwords and MFA, phishing, information handling, and incident
              reporting.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Every year</p>
            <p className="mt-1">All personnel complete a general security awareness course.</p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Every few months</p>
            <p className="mt-1">
              The organization sends a short security awareness message or runs a small campaign.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">Periodically</p>
            <p className="mt-1">
              The organization conducts a phishing simulation or knowledge check.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">After an incident</p>
            <p className="mt-1">
              Targeted awareness is provided if the incident identifies a human-related security
              weakness.
            </p>
          </div>
        </div>
      </Section>

      <Section title="What should you do now?">
        <p>
          If your organization is implementing ISO 27001 for the first time, start by identifying:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong className="text-foreground">Who needs awareness?</strong></li>
          <li><strong className="text-foreground">What security topics are relevant to them?</strong></li>
          <li><strong className="text-foreground">Which training method will you use?</strong></li>
          <li><strong className="text-foreground">Who will provide or deliver the training?</strong></li>
          <li><strong className="text-foreground">When will the training take place?</strong></li>
          <li><strong className="text-foreground">How will completion be recorded?</strong></li>
          <li><strong className="text-foreground">How will you evaluate whether the training was effective?</strong></li>
          <li><strong className="text-foreground">Where will you keep the evidence?</strong></li>
        </ol>
        <p>
          You do not need to develop a complete training platform to satisfy this step. The
          important thing is to establish a <strong className="text-foreground">repeatable
          security awareness process</strong> that fits your organization and can be demonstrated
          to an auditor.
        </p>
      </Section>

      <Section title="APTISO Recommendation">
        <p>
          APTISO can help you define and organize the awareness program without becoming the
          training platform itself. Use the following approach:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong className="text-foreground">Define the audience</strong> — Identify the personnel who require general or role-specific awareness.</li>
          <li><strong className="text-foreground">Select the topics</strong> — Choose the topics relevant to your organization&apos;s risks.</li>
          <li><strong className="text-foreground">Choose the delivery method</strong> — Use an external provider, internal training, workshops, or a combination.</li>
          <li><strong className="text-foreground">Schedule the activity</strong> — Define when initial, onboarding, and periodic awareness activities will take place.</li>
          <li><strong className="text-foreground">Record completion</strong> — Maintain evidence showing who completed the required awareness activities.</li>
          <li><strong className="text-foreground">Evaluate effectiveness</strong> — Use quizzes, simulations, surveys, incident trends, or other appropriate methods.</li>
          <li><strong className="text-foreground">Improve the program</strong> — Update awareness activities based on incidents, audit findings, changes, and emerging threats.</li>
        </ol>
        <p className="font-medium text-foreground mt-2">
          Remember: The objective is not simply to provide training. The objective is to build a
          workforce that understands its information security responsibilities and consistently
          applies secure practices.
        </p>
      </Section>
    </div>
  );
}

const STEP_CONTENT: Record<string, () => ReactNode> = {
  'iso27001.p1s1.intro': IntroToIso27001Content,
  'iso27001.p1s8.security-awareness': SecurityAwarenessContent,
};

export function EducationalStepBody({ stepKey }: { stepKey: string }) {
  const Content = STEP_CONTENT[stepKey];
  if (!Content) {
    return (
      <p className="text-muted-foreground text-sm italic">
        Educational content for this step is being prepared.
      </p>
    );
  }
  return <>{<Content />}</>;
}
