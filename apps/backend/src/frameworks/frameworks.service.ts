import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FrameworksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all compliance frameworks.
   * AVAILABLE entries are returned first; COMING_SOON entries are included
   * so clients can render them as disabled "coming soon" options.
   */
  async findAll() {
    return this.prisma.complianceFramework.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });
  }
}
