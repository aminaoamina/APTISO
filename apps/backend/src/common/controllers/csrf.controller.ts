import { Controller, Get, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../decorators/public.decorator';
import { CsrfGuard } from '../guards/csrf.guard';

@ApiTags('Security')
@Controller('csrf')
export class CsrfController {
  constructor(private readonly csrfGuard: CsrfGuard) {}

  @Public()
  @Get('token')
  @ApiOperation({ summary: 'Get CSRF token' })
  @ApiResponse({
    status: 200,
    description: 'Returns CSRF token for subsequent requests',
    schema: {
      type: 'object',
      properties: {
        csrfToken: { type: 'string', example: 'a1b2c3d4e5f6...' },
      },
    },
  })
  getCsrfToken(@Req() req: Request) {
    const csrfToken = this.csrfGuard.generateToken(req);
    return { csrfToken };
  }
}
