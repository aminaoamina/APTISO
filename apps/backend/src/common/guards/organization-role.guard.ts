import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ORG_ROLES_KEY } from '../decorators/org-role.decorator';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OrganizationRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationRole[]>(
      ORG_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const orgId = request.params?.orgId || request.params?.id;
    if (!orgId) {
      return true;
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organization_id_user_id: {
          organization_id: orgId,
          user_id: user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    request.user = {
      ...user,
      organizationRole: membership.role,
    };

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = requiredRoles.includes(membership.role);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient organization permissions');
    }

    return true;
  }
}
