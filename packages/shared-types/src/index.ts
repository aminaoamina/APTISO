export enum ProjectRole {
  PROJECT_OWNER = 'PROJECT_OWNER',
  CONSULTANT = 'CONSULTANT',
  TEAM_MEMBER = 'TEAM_MEMBER',
  VIEWER = 'VIEWER',
}

export enum OrganizationRole {
  ORG_OWNER = 'ORG_OWNER',
  ORG_ADMIN = 'ORG_ADMIN',
  ORG_MEMBER = 'ORG_MEMBER',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
  EXPIRED = 'EXPIRED',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  IN_PROGRESS = 'IN_PROGRESS',
  CERTIFIED = 'CERTIFIED',
  ON_HOLD = 'ON_HOLD',
}

export enum ProjectPhaseStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
}
