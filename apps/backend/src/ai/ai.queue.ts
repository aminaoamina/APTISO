import { ConfigService } from '@nestjs/config';

/** One queue for every long AI job (review, evidence, indexing): one concurrency limit towards the provider. */
export const AI_QUEUE = 'ai';

/** REDIS_URL (redis://[:password@]host:port[/db]) as BullMQ connection options. */
export function redisConnection(config: ConfigService) {
  const url = new URL(config.get<string>('REDIS_URL') || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
  };
}
