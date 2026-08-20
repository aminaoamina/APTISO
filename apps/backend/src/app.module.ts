import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailModule } from './mail/mail.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { InvitationsService } from './organizations/invitations.service';
import { InvitationPublicController } from './organizations/invitations-public.controller';
import { InvitationsController } from './organizations/invitations.controller';
import { CsrfGuard } from './common/guards/csrf.guard';
import { CsrfController } from './common/controllers/csrf.controller';
import { AuditLogService } from './common/services/audit-log.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationsModule,
    ProjectsModule,
  ],
  controllers: [
    AppController,
    CsrfController,
    InvitationsController,
    InvitationPublicController,
  ],
  providers: [
    CsrfGuard,
    InvitationsService,
    AuditLogService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
