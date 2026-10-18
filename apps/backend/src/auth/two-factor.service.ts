import { createHash, randomBytes } from 'crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { SecretBox } from '../connectors/secret-box';

const ISSUER = 'APTISO';
const STEP_SECONDS = 30;
const RECOVERY_CODES = 10;
const CHALLENGE_TTL = '5m';
const CHALLENGE_PURPOSE = 'two-factor';

// Microsoft/Google Authenticator: SHA-1, 6 digits, 30 s; one step of clock drift either way.
authenticator.options = { window: 1, step: STEP_SECONDS, digits: 6 };

const hash = (code: string) => createHash('sha256').update(code.replace(/[\s-]/g, '').toLowerCase()).digest('hex');
const newRecoveryCode = () => {
  const raw = randomBytes(5).toString('hex'); // 10 hex characters
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
};

/**
 * Optional two-step verification with an authenticator app (TOTP). The
 * secret is stored encrypted; recovery codes only as hashes; a code is
 * accepted once.
 */
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly box: SecretBox,
    private readonly auditLog: AuditLogService,
  ) {}

  async status(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totp_enabled_at: true } });
    const remaining = await this.prisma.twoFactorRecoveryCode.count({ where: { user_id: userId, used_at: null } });
    return { enabled: !!user.totp_enabled_at, enabled_at: user.totp_enabled_at, recovery_codes_left: user.totp_enabled_at ? remaining : 0 };
  }

  /** A new secret, pending until the first code confirms it: QR code for the app, and the key to type by hand. */
  async setup(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, totp_enabled_at: true } });
    if (user.totp_enabled_at) throw new BadRequestException('Two-step verification is already on');
    if (!this.box.enabled) throw new BadRequestException('Two-step verification is not configured on this server (CONNECTOR_SECRET_KEY)');
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totp_secret: this.box.encrypt(secret), totp_last_step: null } });
    const uri = authenticator.keyuri(user.email, ISSUER, secret);
    return { qr_code: await toDataURL(uri, { margin: 1, width: 220 }), secret, uri };
  }

  /** The first code from the app switches it on; the recovery codes are shown once. */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totp_secret: true, totp_enabled_at: true, totp_last_step: true } });
    if (user.totp_enabled_at) throw new BadRequestException('Two-step verification is already on');
    if (!user.totp_secret) throw new BadRequestException('Start the setup first');
    await this.checkCode(userId, user.totp_secret, user.totp_last_step, code);
    await this.prisma.user.update({ where: { id: userId }, data: { totp_enabled_at: new Date() } });
    const codes = await this.replaceRecoveryCodes(userId);
    await this.log(userId, 'two_factor_enabled');
    return { recovery_codes: codes };
  }

  /** Needs the password and a current code (or a recovery code). */
  async disable(userId: string, password: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { password_hash: true } });
    if (!(await argon2.verify(user.password_hash, password))) throw new UnauthorizedException('Wrong password');
    await this.verifySecondFactor(userId, code);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { totp_secret: null, totp_enabled_at: null, totp_last_step: null } }),
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { user_id: userId } }),
    ]);
    await this.log(userId, 'two_factor_disabled');
    return { enabled: false };
  }

  async regenerateRecoveryCodes(userId: string, code: string) {
    await this.verifySecondFactor(userId, code);
    const codes = await this.replaceRecoveryCodes(userId);
    await this.log(userId, 'two_factor_recovery_codes_regenerated');
    return { recovery_codes: codes };
  }

  // ─── Login ─────────────────────────────────────────────────────

  /** After a correct password: a short-lived token that only allows the second step. */
  challenge(userId: string) {
    return this.jwt.sign({ sub: userId, purpose: CHALLENGE_PURPOSE }, { expiresIn: CHALLENGE_TTL });
  }

  /** The second step: the user the challenge was issued for, if the code (or a recovery code) is right. */
  async completeLogin(challengeToken: string, code: string) {
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string; purpose: string }>(challengeToken);
      if (payload.purpose !== CHALLENGE_PURPOSE) throw new Error('wrong purpose');
      userId = payload.sub;
    } catch {
      throw new UnauthorizedException('The sign-in expired: enter your password again');
    }
    try {
      await this.verifySecondFactor(userId, code);
    } catch (e) {
      await this.log(userId, 'two_factor_failed');
      throw e;
    }
    return userId;
  }

  async isEnabled(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { totp_enabled_at: true } });
    return !!user?.totp_enabled_at;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  /** A 6-digit code from the app, or a one-time recovery code. */
  private async verifySecondFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { totp_secret: true, totp_enabled_at: true, totp_last_step: true } });
    if (!user.totp_enabled_at || !user.totp_secret) throw new BadRequestException('Two-step verification is off');
    const digits = code.replace(/\s/g, '');
    if (/^\d{6}$/.test(digits)) return this.checkCode(userId, user.totp_secret, user.totp_last_step, digits);
    const used = await this.prisma.twoFactorRecoveryCode.updateMany({
      where: { user_id: userId, code_hash: hash(code), used_at: null },
      data: { used_at: new Date() },
    });
    if (used.count !== 1) throw new UnauthorizedException('Invalid code');
    await this.log(userId, 'two_factor_recovery_code_used');
  }

  private async checkCode(userId: string, sealedSecret: string, lastStep: number | null, code: string) {
    const delta = authenticator.checkDelta(code.replace(/\s/g, ''), this.box.decrypt(sealedSecret));
    if (delta === null) throw new UnauthorizedException('Invalid code');
    const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta;
    // Each code works once (it stays valid for ~90 s otherwise).
    if (lastStep !== null && step <= lastStep) throw new UnauthorizedException('This code was already used: wait for the next one');
    await this.prisma.user.update({ where: { id: userId }, data: { totp_last_step: step } });
  }

  private async replaceRecoveryCodes(userId: string) {
    const codes = Array.from({ length: RECOVERY_CODES }, newRecoveryCode);
    await this.prisma.$transaction([
      this.prisma.twoFactorRecoveryCode.deleteMany({ where: { user_id: userId } }),
      this.prisma.twoFactorRecoveryCode.createMany({ data: codes.map(c => ({ user_id: userId, code_hash: hash(c) })) }),
    ]);
    return codes;
  }

  private log(userId: string, action: string) {
    return this.auditLog.log({ userId, action: AuditAction.PROFILE_UPDATED, entityType: 'user', entityId: userId, details: { action } });
  }
}
