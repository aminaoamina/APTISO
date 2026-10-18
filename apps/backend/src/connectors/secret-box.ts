import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Encrypts connector tokens at rest (AES-256-GCM) and signs the OAuth state.
 * The key comes from CONNECTOR_SECRET_KEY: without it connectors stay disabled.
 */
@Injectable()
export class SecretBox {
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const secret = config.get<string>('CONNECTOR_SECRET_KEY');
    this.key = secret && secret.length >= 32 ? createHash('sha256').update(secret).digest() : null;
  }

  get enabled() {
    return !!this.key;
  }

  encrypt(plain: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.requireKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64url')).join('.');
  }

  decrypt(sealed: string) {
    const [iv, tag, data] = sealed.split('.').map(p => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', this.requireKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  /** A tamper-proof, expiring value carried through the provider's sign-in page. */
  sign(payload: object, ttlSeconds: number) {
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  verify<T>(token: string): T | null {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp: number };
    return payload.exp > Date.now() ? payload : null;
  }

  private mac(body: string) {
    return createHmac('sha256', this.requireKey()).update(body).digest('base64url');
  }

  private requireKey() {
    if (!this.key) throw new Error('CONNECTOR_SECRET_KEY is not configured');
    return this.key;
  }
}
