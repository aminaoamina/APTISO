import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { FrameworksService } from './frameworks.service';

@ApiTags('Compliance Frameworks')
@ApiBearerAuth()
@Controller('frameworks')
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Get()
  @ApiOperation({ summary: 'List available and upcoming compliance frameworks' })
  @ApiResponse({ status: 200, description: 'List of compliance frameworks' })
  async findAll() {
    return this.frameworksService.findAll();
  }
}
