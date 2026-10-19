import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiServiceClient } from './ai-service.client';

interface Ready {
  status: 'ok' | 'degraded';
  checks: Record<string, { ok: boolean; [k: string]: unknown }>;
}

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiServiceClient) {}

  @Get('health')
  @ApiOperation({ summary: 'AI service status: reachable, and its own dependencies (database, Redis)' })
  async health() {
    const started = Date.now();
    try {
      const { status, data } = await this.aiService.call<Ready>('GET', '/v1/health/ready', undefined, { timeoutMs: 5000 });
      return {
        ai_service: status === 200 ? 'ok' : status === 401 ? 'token refused' : 'degraded',
        latency_ms: Date.now() - started,
        ...(status !== 401 && data?.checks && { checks: data.checks }),
      };
    } catch {
      return { ai_service: 'unreachable', latency_ms: Date.now() - started };
    }
  }
}
