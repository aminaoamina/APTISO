import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Security utilities for token generation, hashing, and validation
 */
export class SecurityUtil {
  /**
   * Generate a cryptographically secure random token
   * @param length - Length in bytes (default: 32)
   * @returns Hex-encoded token string
   */
  static generateSecureToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Generate a shorter alphanumeric code (e.g. invitation codes)
   * @param length - Length of code (default: 10)
   * @returns Alphanumeric code
   */
  static generateAlphanumericCode(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Hash a token using SHA-256
   * @param token - Plain token to hash
   * @returns Hashed token string
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a token against its hash using timing-safe comparison
   */
  static verifyToken(plainToken: string, hashedToken: string): boolean {
    try {
      const computedHash = this.hashToken(plainToken);
      const hashedBuffer = Buffer.from(hashedToken, 'hex');
      const computedBuffer = Buffer.from(computedHash, 'hex');

      if (hashedBuffer.length !== computedBuffer.length) {
        return false;
      }

      return timingSafeEqual(hashedBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize email to prevent injection attacks
   */
  static sanitizeEmail(email: string): string {
    return email.trim().toLowerCase().replace(/[<>'"]/g, '');
  }

  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>'"]/g, '')
      .substring(0, 500);
  }

  /**
   * Generate a unique identifier for rate limiting
   */
  static hashIdentifier(identifier: string): string {
    return createHash('sha256')
      .update(identifier)
      .digest('hex')
      .substring(0, 16);
  }
}
