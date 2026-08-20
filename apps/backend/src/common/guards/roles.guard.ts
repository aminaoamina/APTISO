import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, AuthRole } from '../../common/decorators/roles.decorator';

/**
 * Legacy roles guard. Organization and project roles are now resolved
 * by OrganizationRoleGuard and ProjectRoleGuard respectively.
 * This guard is kept for backward compatibility but is a no-op.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return true;
  }
}
