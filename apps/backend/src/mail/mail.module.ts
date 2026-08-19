import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { HandlebarsTemplateEngine } from './engines/handlebars-template.engine';

@Module({
  providers: [MailService, HandlebarsTemplateEngine],
  exports: [MailService],
})
export class MailModule {}
