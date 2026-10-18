import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DigestService } from './digest.service';

@ApiTags('Weekly digest')
@ApiBearerAuth()
@Controller('digest')
export class DigestController {
  constructor(private readonly digest: DigestService) {}

  @Post('send-now')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: "Send me this week's digest now (it is otherwise sent on Mondays at 08:00)" })
  async sendNow(@CurrentUser('id') userId: string) {
    return { sent: await this.digest.send(userId) };
  }
}
