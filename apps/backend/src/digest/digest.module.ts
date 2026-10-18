import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { MailModule } from '../mail/mail.module';
import { DigestController } from './digest.controller';
import { DigestService } from './digest.service';

@Module({
  imports: [AiModule, MailModule],
  controllers: [DigestController],
  providers: [DigestService],
})
export class DigestModule {}
