import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MailModule } from '../mail/mail.module';
import { AuditLogService } from '../common/services/audit-log.service';
import { SessionService } from '../common/services/session.service';
import { APP_GUARD } from '@nestjs/core';
import { NotificationsModule } from '../notifications/notifications.module';
import { SecretBox } from '../connectors/secret-box';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
    MailModule,
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TwoFactorService,
    SecretBox,
    AuditLogService,
    SessionService,
    JwtStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
