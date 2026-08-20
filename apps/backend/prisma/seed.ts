import { PrismaClient, OrganizationRole, ProjectRole, IsoRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await argon2.hash('DemoPassword123!');

  const owner = await prisma.user.upsert({
    where: { email: 'owner@aptiso.local' },
    update: {},
    create: {
      email: 'owner@aptiso.local',
      first_name: 'Sarah',
      last_name: 'Al-Hamdani',
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aptiso.local' },
    update: {},
    create: {
      email: 'admin@aptiso.local',
      first_name: 'Ahmed',
      last_name: 'Ben-Ali',
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@aptiso.local' },
    update: {},
    create: {
      email: 'member@aptiso.local',
      first_name: 'Leila',
      last_name: 'Mansour',
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
    },
  });

  const org = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ASM Pilot Co.',
      description: 'Pilot organization for APTISO platform testing',
      industry: 'Technology',
      created_by: owner.id,
      members: {
        createMany: {
          data: [
            { user_id: owner.id, role: OrganizationRole.ORG_OWNER },
            { user_id: admin.id, role: OrganizationRole.ORG_ADMIN },
            { user_id: member.id, role: OrganizationRole.ORG_MEMBER },
          ],
        },
      },
    },
  });

  const project = await prisma.complianceProject.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      organization_id: org.id,
      name: 'ISO 27001:2022 Initial Certification',
      description: 'Full ISMS implementation and certification project',
      status: 'IN_PROGRESS',
      start_date: new Date('2026-01-15'),
      target_date: new Date('2026-07-15'),
      created_by: owner.id,
      phases: {
        createMany: {
          data: [
            { name: 'Gap Assessment', description: 'Identify gaps between current state and ISO 27001 requirements', order: 1, status: 'COMPLETED', started_at: new Date('2026-01-15'), completed_at: new Date('2026-02-28') },
            { name: 'Risk Assessment', description: 'Identify and evaluate information security risks', order: 2, status: 'COMPLETED', started_at: new Date('2026-03-01'), completed_at: new Date('2026-03-31') },
            { name: 'Control Selection', description: 'Select appropriate security controls from Annex A', order: 3, status: 'IN_PROGRESS', started_at: new Date('2026-04-01') },
            { name: 'Implementation', description: 'Implement selected controls and document policies', order: 4, status: 'NOT_STARTED' },
            { name: 'Internal Audit', description: 'Conduct internal audit of the ISMS', order: 5, status: 'NOT_STARTED' },
            { name: 'Management Review', description: 'Management review of ISMS performance', order: 6, status: 'NOT_STARTED' },
            { name: 'Certification Readiness', description: 'Prepare for external certification audit', order: 7, status: 'NOT_STARTED' },
          ],
        },
      },
      members: {
        createMany: {
          data: [
            { user_id: owner.id, privilege: ProjectRole.PROJECT_LEAD },
            { user_id: admin.id, privilege: ProjectRole.PROJECT_AUDITOR },
            { user_id: member.id, privilege: ProjectRole.PROJECT_MEMBER },
          ],
        },
      },
    },
  });

  const ownerMember = await prisma.projectMember.findFirst({
    where: { project_id: project.id, user_id: owner.id },
  });

  const adminMember = await prisma.projectMember.findFirst({
    where: { project_id: project.id, user_id: admin.id },
  });

  if (ownerMember) {
    await prisma.projectMember.update({
      where: { id: ownerMember.id },
      data: { custom_role: 'CISO' },
    });

    await prisma.projectMemberIsoRole.createMany({
      data: [
        { project_member_id: ownerMember.id, iso_role: IsoRole.INFORMATION_SECURITY_MANAGER },
        { project_member_id: ownerMember.id, iso_role: IsoRole.TOP_MANAGEMENT },
      ],
    });
  }

  if (adminMember) {
    await prisma.projectMember.update({
      where: { id: adminMember.id },
      data: { custom_role: 'IT Manager' },
    });

    await prisma.projectMemberIsoRole.createMany({
      data: [
        { project_member_id: adminMember.id, iso_role: IsoRole.IT_ADMINISTRATOR },
        { project_member_id: adminMember.id, iso_role: IsoRole.INTERNAL_AUDITOR },
      ],
    });
  }

  console.log('--- Seed complete ---');
  console.log('Demo users (all passwords: DemoPassword123!):');
  console.log('  Owner:  owner@aptiso.local  (Sarah Al-Hamdani)');
  console.log('  Admin:  admin@aptiso.local  (Ahmed Ben-Ali)');
  console.log('  Member: member@aptiso.local (Leila Mansour)');
  console.log('');
  console.log('Organization: ASM Pilot Co.');
  console.log('Project: ISO 27001:2022 Initial Certification');
  console.log('Phases: Gap Assessment (done), Risk Assessment (done), Control Selection (in progress)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
