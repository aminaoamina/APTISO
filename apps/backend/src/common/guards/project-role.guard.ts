import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROJECT_ROLES_KEY } from '../decorators/project-role.decorator';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectRoleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ProjectRole[]>(
      PROJECT_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const projectId = await this.resolveProjectId(request.params ?? {});
    if (!projectId) {
      return true;
    }

    const membership = await this.prisma.projectMember.findUnique({
      where: {
        project_id_user_id: {
          project_id: projectId,
          user_id: user.id,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Project not found or you are not a member');
    }

    request.user = {
      ...user,
      projectRole: membership.privilege,
    };

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const hasRole = requiredRoles.includes(membership.privilege);

    if (!hasRole) {
      throw new ForbiddenException('Insufficient project permissions');
    }

    return true;
  }

  /**
   * Routes nested under a step, risk, requirement, SoA control, document, request or evidence do not carry
   * :projectId, so resolve the owning project from whichever id is present.
   * Without this the guard silently skipped membership and role checks.
   */
  private async resolveProjectId(params: Record<string, string>): Promise<string | null> {
    if (params.projectId) return params.projectId;

    if (params.evidenceId) {
      const evidence = await this.prisma.evidence.findUnique({ where: { id: params.evidenceId }, select: { project_id: true } });
      if (!evidence) throw new NotFoundException('Evidence not found');
      return evidence.project_id;
    }

    if (params.requestId) {
      const request = await this.prisma.resourceRequest.findUnique({ where: { id: params.requestId }, select: { project_id: true } });
      if (!request) throw new NotFoundException('Request not found');
      return request.project_id;
    }

    let stepId: string | null | undefined = params.stepId;

    if (!stepId && params.riskId) {
      const risk = await this.prisma.riskItem.findUnique({
        where: { id: params.riskId },
        select: { step_id: true },
      });
      if (!risk) throw new NotFoundException('Risk not found');
      stepId = risk.step_id;
    }

    if (!stepId && params.requirementId) {
      const requirement = await this.prisma.requirement.findUnique({
        where: { id: params.requirementId },
        select: { step_id: true },
      });
      if (!requirement) throw new NotFoundException('Requirement not found');
      stepId = requirement.step_id;
    }

    if (!stepId && params.soaControlId) {
      const row = await this.prisma.soaControl.findUnique({
        where: { id: params.soaControlId },
        select: { step_id: true },
      });
      if (!row) throw new NotFoundException('Control not found');
      stepId = row.step_id;
    }

    if (!stepId && params.documentId) {
      const document = await this.prisma.documentInstance.findUnique({
        where: { id: params.documentId },
        select: { step_id: true },
      });
      if (!document) throw new NotFoundException('Document not found');
      stepId = document.step_id;
    }

    if (!stepId) return null;

    const step = await this.prisma.projectStep.findUnique({
      where: { id: stepId },
      select: { phase: { select: { project_id: true } } },
    });
    if (!step) throw new NotFoundException('Step not found');
    return step.phase.project_id;
  }
}
