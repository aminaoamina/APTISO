import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import {
  EmailConfig,
  EmailTemplate,
  IMailService,
} from './interfaces/mail.interface';
import { HandlebarsTemplateEngine } from './engines/handlebars-template.engine';

@Injectable()
export class MailService implements IMailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private emailConfig: EmailConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly templateEngine: HandlebarsTemplateEngine,
  ) {
    this.emailConfig = this.buildEmailConfig();
    this.transporter = this.createTransporter();
  }

  async sendVerificationEmail(
    email: string,
    fullName: string,
    verificationToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

    const emailTemplate: EmailTemplate = {
      to: email,
      subject: 'APTISO - Verify Your Email',
      template: 'email-verification.hbs',
      context: {
        fullName,
        verificationLink,
        frontendUrl,
      },
    };

    await this.sendEmail(emailTemplate);
    this.logger.log(`Verification email sent to ${email}`);
  }

  async sendPasswordResetEmail(
    email: string,
    fullName: string,
    resetCode: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );

    const emailTemplate: EmailTemplate = {
      to: email,
      subject: 'APTISO - Password Reset Code',
      template: 'password-reset.hbs',
      context: {
        fullName,
        resetCode,
        frontendUrl,
        expiryMinutes: 10,
      },
    };

    await this.sendEmail(emailTemplate);
    this.logger.log(`Password reset code sent to ${email}`);
  }

  async sendInvitationEmail(
    email: string,
    invitedByName: string,
    organizationName: string,
    role: string,
    inviteToken: string,
  ): Promise<void> {
    const frontendUrl = this.configService.get(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const acceptLink = `${frontendUrl}/accept-invitation?token=${inviteToken}`;

    const emailTemplate: EmailTemplate = {
      to: email,
      subject: `You've Been Invited to Join ${organizationName} on APTISO`,
      template: 'organization-invitation.hbs',
      context: {
        invitedByName,
        organizationName,
        role,
        acceptLink,
        frontendUrl,
        expiryDays: 7,
      },
    };

    await this.sendEmail(emailTemplate);
    this.logger.log(`Invitation email sent to ${email}`);
  }

  private async sendEmail(emailTemplate: EmailTemplate): Promise<void> {
    try {
      const html = await this.templateEngine.compile(
        emailTemplate.template,
        emailTemplate.context,
      );

      const mailOptions = {
        from: `"${this.emailConfig.from.name}" <${this.emailConfig.from.address}>`,
        to: emailTemplate.to,
        subject: emailTemplate.subject,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      this.logger.debug(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${emailTemplate.to}:`, error);
      throw new Error(`Email sending failed: ${(error as Error).message}`);
    }
  }

  private buildEmailConfig(): EmailConfig {
    const user = this.configService.get('SMTP_USER') || '';
    const pass = this.configService.get('SMTP_PASS') || '';

    return {
      host: this.configService.get('SMTP_HOST', 'localhost'),
      port: parseInt(this.configService.get('SMTP_PORT', '1025'), 10),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: user ? { user, pass } : undefined,
      from: {
        name: this.configService.get('EMAIL_FROM_NAME', 'APTISO'),
        address:
          this.configService.get('EMAIL_FROM') ||
          user ||
          'no-reply@aptiso.local',
      },
    };
  }

  private createTransporter(): nodemailer.Transporter {
    const transportOptions: SMTPTransport.Options = {
      host: this.emailConfig.host,
      port: this.emailConfig.port,
      secure: this.emailConfig.secure,
    };

    if (this.emailConfig.auth) {
      transportOptions.auth = this.emailConfig.auth;
    }

    return nodemailer.createTransport(transportOptions);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection failed:', error);
      return false;
    }
  }
}
