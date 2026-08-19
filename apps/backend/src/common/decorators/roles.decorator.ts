import { SetMetadata } from '@nestjs/common';
import { ProjectRole, OrganizationRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export type AuthRole = ProjectRole | OrganizationRole;

export const Roles = (...roles: AuthRole[]) => SetMetadata(ROLES_KEY, roles);
