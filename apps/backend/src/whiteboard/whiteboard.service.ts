import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../common/services/project-access.service';

/** One whiteboard per project: a tldraw snapshot, saved as the members draw. */
@Injectable()
export class WhiteboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async get(projectId: string, userId: string) {
    const access = await this.access.forProject(projectId, userId);
    const board = await this.prisma.whiteboard.findUnique({
      where: { project_id: projectId },
      select: { snapshot: true, updated_at: true, updated_by: true },
    });
    const editor = board ? await this.prisma.user.findUnique({ where: { id: board.updated_by }, select: { first_name: true, last_name: true } }) : null;
    return {
      snapshot: board?.snapshot ?? null,
      updated_at: board?.updated_at ?? null,
      updated_by: editor ? `${editor.first_name} ${editor.last_name}`.trim() : null,
      canEdit: access.canEdit,
    };
  }

  async save(projectId: string, userId: string, snapshot: Record<string, unknown>) {
    this.access.assertEdit(await this.access.forProject(projectId, userId));
    const data = { snapshot: snapshot as Prisma.InputJsonValue, updated_by: userId };
    const board = await this.prisma.whiteboard.upsert({ where: { project_id: projectId }, update: data, create: { project_id: projectId, ...data } });
    return { updated_at: board.updated_at };
  }
}
