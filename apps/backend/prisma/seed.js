"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const argon2 = __importStar(require("argon2"));
const prisma = new client_1.PrismaClient();
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
//# sourceMappingURL=seed.js.map