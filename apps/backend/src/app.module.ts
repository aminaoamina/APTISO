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
import { FrameworksModule } from './frameworks/frameworks.module';
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
    FrameworksModule,
  ],
  controllers: [
    AppController,
    CsrfController,
  ],
  providers: [
    CsrfGuard,
    AuditLogService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
