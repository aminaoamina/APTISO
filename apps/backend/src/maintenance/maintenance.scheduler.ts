import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceService } from './maintenance.service';

/**
 * Nightly maintenance run: creates the tasks of recurring ISMS activities
 * even when nobody opens the application. The run is idempotent, so several
 * backend instances running it at the same time do not create duplicates.
 */
@Injectable()
export class MaintenanceScheduler {
  private running = false;

  constructor(private readonly maintenance: MaintenanceService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'isms-maintenance' })
  async nightly() {
    if (this.running) return;
    this.running = true;
    try {
      await this.maintenance.runAll();
    } finally {
      this.running = false;
    }
  }
}
