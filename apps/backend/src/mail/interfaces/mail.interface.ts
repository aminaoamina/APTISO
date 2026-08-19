export interface EmailTemplate {
  to: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: {
    name: string;
    address: string;
  };
}

export interface IMailService {
  sendVerificationEmail(
    email: string,
    fullName: string,
    verificationToken: string,
  ): Promise<void>;
  sendPasswordResetEmail(
    email: string,
    fullName: string,
    resetCode: string,
  ): Promise<void>;
  sendInvitationEmail(
    email: string,
    invitedByName: string,
    organizationName: string,
    role: string,
    inviteToken: string,
  ): Promise<void>;
}

export interface ITemplateEngine {
  compile(templatePath: string, context: Record<string, any>): Promise<string>;
}
