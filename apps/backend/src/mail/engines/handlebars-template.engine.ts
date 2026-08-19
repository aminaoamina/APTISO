import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';
import { ITemplateEngine } from '../interfaces/mail.interface';

@Injectable()
export class HandlebarsTemplateEngine implements ITemplateEngine {
  private readonly logger = new Logger(HandlebarsTemplateEngine.name);
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();

  async compile(
    templatePath: string,
    context: Record<string, any>,
  ): Promise<string> {
    try {
      let template = this.templateCache.get(templatePath);

      if (!template) {
        const templateContent = await this.loadTemplate(templatePath);
        template = handlebars.compile(templateContent);
        this.templateCache.set(templatePath, template);
      }

      return template(context);
    } catch (error) {
      this.logger.error(`Failed to compile template ${templatePath}:`, error);
      throw new Error(`Template compilation failed: ${(error as Error).message}`);
    }
  }

  private async loadTemplate(templatePath: string): Promise<string> {
    const possiblePaths = [
      path.resolve(__dirname, '../templates', templatePath),
      path.resolve(process.cwd(), 'src/mail/templates', templatePath),
      path.resolve(process.cwd(), 'dist/mail/templates', templatePath),
    ];

    for (const fullPath of possiblePaths) {
      try {
        if (fs.existsSync(fullPath)) {
          this.logger.debug(`Loading template from: ${fullPath}`);
          return fs.readFileSync(fullPath, 'utf-8');
        }
      } catch (error) {
        this.logger.warn(`Failed to read template from ${fullPath}:`, error);
      }
    }

    throw new Error(
      `Template not found: ${templatePath}. Searched paths: ${possiblePaths.join(', ')}`,
    );
  }

  clearCache(): void {
    this.templateCache.clear();
  }
}
