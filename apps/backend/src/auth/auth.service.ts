import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomInt } from 'crypto';
import { addHours, addMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { SecurityUtil } from '../common/utils/security.util';
import { AuditLogService } from '../common/services/audit-log.service';
import { SessionService } from '../common/services/session.service';
import {
  RegisterDto,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto/auth.dto';
import {
  AuthTokens,
  UserPayload,
  RegisterResponse,
  LoginResponse,
  PublicUser,
} from './interfaces/auth.interface';
import {
  VerificationStatus,
  PasswordResetStatus,
  InvitationStatus,
  AuditAction,
} from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly auditLogService: AuditLogService,
    private readonly sessionService: SessionService,
  ) {}

  async register(
    registerDto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<RegisterResponse> {
    try {
      const sanitizedEmail = SecurityUtil.sanitizeEmail(registerDto.email);
      const sanitizedFirstName = SecurityUtil.sanitizeString(
        registerDto.first_name,
      );
      const sanitizedLastName = SecurityUtil.sanitizeString(
        registerDto.last_name,
      );

      const existingUser = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      const hashedPassword = await argon2.hash(registerDto.password);

      // Optional invitation token (APT-012). If present and valid, the user is
      // auto-activated and linked to the organization/project.
      let invitation: any = null;
      if (registerDto.invitation_token) {
        const hashedToken = SecurityUtil.hashToken(
          registerDto.invitation_token,
        );

        invitation = await this.prisma.invitation.findFirst({
          where: {
            hashed_token: hashedToken,
            status: InvitationStatus.PENDING,
            invited_email: sanitizedEmail,
            expires_at: {
              gte: new Date(),
            },
          },
        });

        if (!invitation) {
          throw new BadRequestException('Invalid or expired invitation token');
        }
      }

      const user = await this.prisma.user.create({
        data: {
          email: sanitizedEmail,
          first_name: sanitizedFirstName,
          last_name: sanitizedLastName,
          password_hash: hashedPassword,
          is_active: !!invitation,
          is_email_verified: !!invitation,
        },
      });

      if (invitation) {
        await this.prisma.$transaction([
          this.prisma.organizationMember.create({
            data: {
              organization_id: invitation.organization_id,
              user_id: user.id,
              role: 'ORG_MEMBER',
            },
          }),
          ...(invitation.project_id
            ? [
                this.prisma.projectMember.create({
                  data: {
                    project_id: invitation.project_id,
                    user_id: user.id,
                    role: invitation.role,
                  },
                }),
              ]
            : []),
          this.prisma.invitation.update({
            where: { id: invitation.id },
            data: {
              status: InvitationStatus.ACCEPTED,
              accepted_by: user.id,
              accepted_at: new Date(),
            },
          }),
        ]);

        await this.auditLogService.log({
          userId: user.id,
          action: AuditAction.USER_REGISTERED,
          entityType: 'user',
          entityId: user.id,
          details: { withInvitation: true, organizationId: invitation.organization_id },
          ipAddress,
          userAgent,
        });

        this.logger.log(`User registered with invitation: ${user.email}`);

        return {
          message:
            'Registration successful! You have been added to the organization. You can now log in.',
        };
      }

      // Standard registration: require email verification
      const verificationToken = this.generateVerificationToken();
      const hashedToken = SecurityUtil.hashToken(verificationToken);
      const expiresAt = addMinutes(new Date(), 15);

      await this.prisma.emailVerification.create({
        data: {
          user_id: user.id,
          hashed_verification_token: hashedToken,
          expires_at: expiresAt,
          status: VerificationStatus.PENDING,
        },
      });

      try {
        await this.mailService.sendVerificationEmail(
          user.email,
          `${user.first_name} ${user.last_name}`,
          verificationToken,
        );
      } catch (emailError) {
        this.logger.warn(
          `Verification email could not be sent to ${user.email}: ${(emailError as Error).message}`,
        );
      }

      await this.auditLogService.log({
        userId: user.id,
        action: AuditAction.USER_REGISTERED,
        entityType: 'user',
        entityId: user.id,
        details: { withInvitation: false },
        ipAddress,
        userAgent,
      });

      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        message:
          'Registration successful! Please check your email to verify your account.',
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException('Registration failed. Please try again.');
    }
  }

  /**
   * Login with cookie-based authentication and session tracking.
   * Returns the tokens so the controller can set HttpOnly cookies with the
   * exact same pair that was persisted to the Session table.
   */
  async loginWithCookies(
    loginDto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    this.logger.log(`[LOGIN] Attempting login for email: ${loginDto.email}`);

    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email },
    });

    if (!user) {
      this.logger.warn(`[LOGIN] User not found: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(
      user.password_hash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(`[LOGIN] Invalid password for: ${loginDto.email}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      this.logger.warn(`[LOGIN] Account not active: ${loginDto.email}`);
      throw new UnauthorizedException(
        'Account is not activated. Please verify your email.',
      );
    }

    if (!user.is_email_verified) {
      this.logger.warn(`[LOGIN] Email not verified: ${loginDto.email}`);
      throw new UnauthorizedException(
        'Email is not verified. Please check your email and verify your account.',
      );
    }

    const tokens = await this.generateTokens(user.id, user.email);

    const session = await this.sessionService.createSession({
      userId: user.id,
      refreshToken: tokens.refresh_token,
      ipAddress,
      userAgent,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.USER_LOGIN,
      entityType: 'user',
      entityId: user.id,
      ipAddress,
      userAgent,
    });

    this.logger.log(`User logged in with cookies: ${user.email}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        is_email_verified: user.is_email_verified,
      },
      sessionId: session.id,
      tokens,
    };
  }

  /**
   * Refresh access token using refresh token (with rotation)
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const sessionData =
      await this.sessionService.validateRefreshToken(refreshToken);

    if (!sessionData) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: sessionData.userId },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user.id, user.email);

    await this.sessionService.rotateRefreshToken(
      sessionData.sessionId,
      tokens.refresh_token,
    );

    await this.auditLogService.log({
      userId: user.id,
      action: AuditAction.TOKEN_REFRESHED,
      entityType: 'session',
      entityId: sessionData.sessionId,
      ipAddress,
      userAgent,
    });

    this.logger.log(`Tokens refreshed for user: ${user.email}`);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        is_email_verified: user.is_email_verified,
      },
    };
  }

  /**
   * Logout: revoke the session tied to the refresh cookie, if any
   */
  async logoutWithCookies(refreshToken?: string): Promise<{ message: string }> {
    if (refreshToken) {
      await this.sessionService.revokeByRefreshToken(refreshToken);
    }

    return { message: 'Logged out successfully' };
  }

  async verifyEmail(verificationToken: string): Promise<{ message: string }> {
    try {
      const hashedToken = SecurityUtil.hashToken(verificationToken);

      const verification = await this.prisma.emailVerification.findUnique({
        where: { hashed_verification_token: hashedToken },
        include: { user: true },
      });

      if (!verification) {
        throw new BadRequestException('Invalid verification link');
      }

      if (verification.status === VerificationStatus.VERIFIED) {
        throw new BadRequestException('Email is already verified');
      }

      if (verification.expires_at < new Date()) {
        await this.prisma.emailVerification.update({
          where: { id: verification.id },
          data: { status: VerificationStatus.EXPIRED },
        });
        throw new BadRequestException('Verification link has expired');
      }

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: verification.user_id },
          data: {
            is_active: true,
            is_email_verified: true,
          },
        }),
        this.prisma.emailVerification.update({
          where: { id: verification.id },
          data: { status: VerificationStatus.VERIFIED },
        }),
      ]);

      await this.auditLogService.log({
        userId: verification.user_id,
        action: AuditAction.EMAIL_VERIFIED,
        entityType: 'user',
        entityId: verification.user_id,
      });

      this.logger.log(
        `Email verified successfully for user: ${verification.user.email}`,
      );

      return {
        message:
          'Email verified successfully! You can now log in to your account.',
      };
    } catch (error) {
      this.logger.error('Email verification failed:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Email verification failed. Please try again.',
      );
    }
  }

  async resendVerificationEmail(userId: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (user.is_email_verified) {
        throw new BadRequestException('Email is already verified');
      }

      const verificationToken = this.generateVerificationToken();
      const hashedToken = SecurityUtil.hashToken(verificationToken);
      const expiresAt = addMinutes(new Date(), 15);

      const existingVerification =
        await this.prisma.emailVerification.findFirst({
          where: {
            user_id: user.id,
            status: VerificationStatus.PENDING,
          },
        });

      if (existingVerification) {
        await this.prisma.emailVerification.update({
          where: { id: existingVerification.id },
          data: {
            hashed_verification_token: hashedToken,
            expires_at: expiresAt,
          },
        });
      } else {
        await this.prisma.emailVerification.create({
          data: {
            user_id: user.id,
            hashed_verification_token: hashedToken,
            expires_at: expiresAt,
            status: VerificationStatus.PENDING,
          },
        });
      }

      await this.mailService.sendVerificationEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        verificationToken,
      );

      this.logger.log(`Verification email resent for user: ${user.email}`);

      return {
        message:
          'Verification email sent successfully. Please check your email.',
      };
    } catch (error) {
      this.logger.error('Resend verification email failed:', error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to resend verification email. Please try again.',
      );
    }
  }

  /**
   * Public resend of the verification email, keyed by email instead of a
   * session. Returns a neutral message so unverified users aren't locked out
   * without leaking whether an account exists.
   */
  async resendVerificationCode(
    email: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({ where: { email } });

      if (!user || user.is_email_verified) {
        return {
          message:
            'If an account with that email exists and is unverified, a new verification email has been sent.',
        };
      }

      const verificationToken = this.generateVerificationToken();
      const hashedToken = SecurityUtil.hashToken(verificationToken);
      const expiresAt = addMinutes(new Date(), 15);

      const existingVerification =
        await this.prisma.emailVerification.findFirst({
          where: {
            user_id: user.id,
            status: VerificationStatus.PENDING,
          },
        });

      if (existingVerification) {
        await this.prisma.emailVerification.update({
          where: { id: existingVerification.id },
          data: {
            hashed_verification_token: hashedToken,
            expires_at: expiresAt,
          },
        });
      } else {
        await this.prisma.emailVerification.create({
          data: {
            user_id: user.id,
            hashed_verification_token: hashedToken,
            expires_at: expiresAt,
            status: VerificationStatus.PENDING,
          },
        });
      }

      await this.mailService.sendVerificationEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        verificationToken,
      );

      this.logger.log(
        `Verification email resent (public) for user: ${user.email}`,
      );

      return {
        message:
          'If an account with that email exists and is unverified, a new verification email has been sent.',
      };
    } catch (error) {
      this.logger.error('Public resend verification email failed:', error);
      return {
        message:
          'If an account with that email exists and is unverified, a new verification email has been sent.',
      };
    }
  }

  async requestPasswordReset(
    email: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return {
          message:
            'If an account with that email exists, you will receive a password reset link.',
        };
      }

      const resetCode = randomInt(10000, 100000).toString();
      const expiresAt = addHours(new Date(), 1);

      await this.prisma.passwordReset.create({
        data: {
          user_id: user.id,
          reset_code: resetCode,
          expires_at: expiresAt,
          status: PasswordResetStatus.PENDING,
        },
      });

      await this.mailService.sendPasswordResetEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        resetCode,
      );

      await this.auditLogService.log({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_REQUESTED,
        entityType: 'user',
        entityId: user.id,
      });

      this.logger.log(`Password reset requested for user: ${user.email}`);

      return {
        message:
          'If an account with that email exists, you will receive a password reset link.',
      };
    } catch (error) {
      this.logger.error('Password reset request failed:', error);
      throw new BadRequestException(
        'Password reset request failed. Please try again.',
      );
    }
  }

  async verifyResetCode(
    email: string,
    resetCode: string,
  ): Promise<{ message: string; valid: boolean }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return { message: 'Invalid email', valid: false };
      }

      const resetRecord = await this.prisma.passwordReset.findFirst({
        where: {
          user_id: user.id,
          reset_code: resetCode,
          status: PasswordResetStatus.PENDING,
          expires_at: {
            gte: new Date(),
          },
        },
      });

      if (resetRecord) {
        return { message: 'Code is valid', valid: true };
      }
      return { message: 'Invalid or expired code', valid: false };
    } catch (error) {
      this.logger.error('Reset code verification failed:', error);
      return { message: 'Verification failed', valid: false };
    }
  }

  async resetPassword(
    email: string,
    resetCode: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new BadRequestException('Invalid email');
      }

      const resetRecord = await this.prisma.passwordReset.findFirst({
        where: {
          user_id: user.id,
          reset_code: resetCode,
          status: PasswordResetStatus.PENDING,
          expires_at: {
            gte: new Date(),
          },
        },
      });

      if (!resetRecord) {
        throw new BadRequestException('Invalid or expired reset code');
      }

      const hashedPassword = await argon2.hash(newPassword);

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: resetRecord.user_id },
          data: { password_hash: hashedPassword },
        }),
        this.prisma.passwordReset.update({
          where: { id: resetRecord.id },
          data: { status: PasswordResetStatus.USED },
        }),
        this.prisma.session.updateMany({
          where: { user_id: user.id, is_active: true },
          data: { is_active: false },
        }),
      ]);

      await this.auditLogService.log({
        userId: user.id,
        action: AuditAction.PASSWORD_RESET_COMPLETED,
        entityType: 'user',
        entityId: user.id,
      });

      this.logger.log(`Password reset successfully for user: ${user.email}`);

      return {
        message:
          'Password reset successfully! You can now log in with your new password.',
      };
    } catch (error) {
      this.logger.error('Password reset failed:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Password reset failed. Please try again.');
    }
  }

  async resendResetCode(email: string): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return {
          message:
            'If an account with that email exists, you will receive a new reset code.',
        };
      }

      const resetCode = randomInt(10000, 100000).toString();
      const expiresAt = addHours(new Date(), 1);

      const existingReset = await this.prisma.passwordReset.findFirst({
        where: {
          user_id: user.id,
          status: PasswordResetStatus.PENDING,
        },
      });

      if (existingReset) {
        await this.prisma.passwordReset.update({
          where: { id: existingReset.id },
          data: {
            reset_code: resetCode,
            expires_at: expiresAt,
            attempts: 0,
          },
        });
      } else {
        await this.prisma.passwordReset.create({
          data: {
            user_id: user.id,
            reset_code: resetCode,
            expires_at: expiresAt,
            status: PasswordResetStatus.PENDING,
          },
        });
      }

      await this.mailService.sendPasswordResetEmail(
        user.email,
        `${user.first_name} ${user.last_name}`,
        resetCode,
      );

      this.logger.log(`Reset code resent for user: ${user.email}`);

      return {
        message:
          'If an account with that email exists, you will receive a new reset code.',
      };
    } catch (error) {
      this.logger.error('Resend reset code failed:', error);
      throw new BadRequestException(
        'Failed to resend reset code. Please try again.',
      );
    }
  }

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<{ message: string; user: any }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const updateData: any = {};

      if (updateProfileDto.first_name) {
        updateData.first_name = SecurityUtil.sanitizeString(
          updateProfileDto.first_name,
        );
      }

      if (updateProfileDto.last_name) {
        updateData.last_name = SecurityUtil.sanitizeString(
          updateProfileDto.last_name,
        );
      }

      if (updateProfileDto.email) {
        const sanitizedEmail = SecurityUtil.sanitizeEmail(
          updateProfileDto.email,
        );

        if (sanitizedEmail !== user.email) {
          const existingUser = await this.prisma.user.findUnique({
            where: { email: sanitizedEmail },
          });

          if (existingUser) {
            throw new ConflictException('Email is already in use');
          }

          updateData.email = sanitizedEmail;
          updateData.is_email_verified = false;
        }
      }

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          is_email_verified: true,
          created_at: true,
        },
      });

      if (updateData.email && updateData.email !== user.email) {
        const verificationToken = this.generateVerificationToken();
        const hashedToken = SecurityUtil.hashToken(verificationToken);
        const expiresAt = addMinutes(new Date(), 15);

        await this.prisma.emailVerification.create({
          data: {
            user_id: updatedUser.id,
            hashed_verification_token: hashedToken,
            expires_at: expiresAt,
            status: VerificationStatus.PENDING,
          },
        });

        await this.mailService.sendVerificationEmail(
          updateData.email,
          `${updatedUser.first_name} ${updatedUser.last_name}`,
          verificationToken,
        );
      }

      await this.auditLogService.log({
        userId,
        action: AuditAction.PROFILE_UPDATED,
        entityType: 'user',
        entityId: userId,
      });

      return { message: 'Profile updated successfully', user: updatedUser };
    } catch (error) {
      this.logger.error(
        `Failed to update profile for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async changePassword(
    userId: string,
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password_hash: true },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const isPasswordValid = await argon2.verify(
        user.password_hash,
        changePasswordDto.current_password,
      );

      if (!isPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      const isSamePassword = await argon2.verify(
        user.password_hash,
        changePasswordDto.new_password,
      );

      if (isSamePassword) {
        throw new BadRequestException(
          'New password must be different from current password',
        );
      }

      const hashedPassword = await argon2.hash(changePasswordDto.new_password);

      await this.prisma.user.update({
        where: { id: userId },
        data: { password_hash: hashedPassword },
      });

      await this.auditLogService.log({
        userId,
        action: AuditAction.PASSWORD_CHANGED,
        entityType: 'user',
        entityId: userId,
        details: { method: 'change_password' },
      });

      return { message: 'Password changed successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to change password for user ${userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async getUserSessions(userId: string, currentSessionId?: string) {
    return this.sessionService.getUserSessions(userId, currentSessionId);
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    const revoked = await this.sessionService.revokeSession(sessionId, userId);

    if (!revoked) {
      throw new NotFoundException('Session not found');
    }

    return { message: 'Session revoked successfully' };
  }

  async logoutAllDevices(
    userId: string,
  ): Promise<{ message: string; count: number }> {
    const count = await this.sessionService.revokeAllUserSessions(userId);
    return {
      message: `Logged out from ${count} device(s)`,
      count,
    };
  }

  private async generateTokens(
    userId: string,
    email: string,
  ): Promise<AuthTokens> {
    const payload: UserPayload = {
      sub: userId,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }
}
