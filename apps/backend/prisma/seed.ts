// Sprint 1 seed: creates a demo user + organization + compliance project
// so the app is usable immediately after `npm run db:migrate`.
// Run with: npm run db:seed

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@aptiso.local';
  const passwordHash = await argon2.hash('DemoPassword123!');

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      first_name: 'Demo',
      last_name: 'User',
      password_hash: passwordHash,
      is_active: true,
      is_email_verified: true,
    },
  });

  const org = await prisma.organization.create({
    data: {
      name: 'ASM Pilot Co.',
      description: 'Pilot organization for the APTISO platform',
      industry: 'Consulting',
      created_by: user.id,
      members: {
        create: {
          user_id: user.id,
          role: 'ORG_OWNER',
        },
      },
    },
  });

  await prisma.complianceProject.create({
    data: {
      organization_id: org.id,
      name: 'ISO 27001:2022 Initial Certification',
      description: 'Stand up the ISMS and achieve initial certification.',
      status: 'PLANNING',
      created_by: user.id,
      phases: {
        create: [
          { name: 'Scoping & Planning', order: 1 },
          { name: 'Gap Assessment', order: 2 },
          { name: 'Risk Management', order: 3 },
          { name: 'Statement of Applicability', order: 4 },
          { name: 'Implementation', order: 5 },
          { name: 'Internal Audit', order: 6 },
          { name: 'Certification Audit', order: 7 },
        ],
      },
    },
  });

  console.log('Seeded demo user, organization and compliance project.');
  console.log('Login: demo@aptiso.local / DemoPassword123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
