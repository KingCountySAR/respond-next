/**
 * Secrets kept in the database (member providers' client secrets), encrypted with AES-256-GCM under
 * SECRETS_KEY: 32 random bytes, base64. Make one with
 * `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
 * Losing the key loses the secrets: they have to be entered again.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class SecretBox {
  private readonly key: Buffer | undefined;

  /** `key` is base64; without one, nothing can be encrypted or decrypted. */
  constructor(key: string | undefined) {
    if (!key) return;
    const bytes = Buffer.from(key, 'base64');
    if (bytes.length !== 32) throw new Error('SECRETS_KEY must be 32 bytes, base64');
    this.key = bytes;
  }

  /** A key for this process only: for in-memory storage, which forgets everything anyway. */
  static ephemeral(): SecretBox {
    return new SecretBox(randomBytes(32).toString('base64'));
  }

  get ready(): boolean {
    return !!this.key;
  }

  encrypt(plain: string): string {
    const key = this.need();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return `${VERSION}:${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
  }

  decrypt(sealed: string): string {
    const key = this.need();
    const [version, body] = sealed.split(':');
    if (version !== VERSION || !body) throw new Error('not an encrypted secret');
    const bytes = Buffer.from(body, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, IV_BYTES));
    decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    try {
      return Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('cannot decrypt a stored secret: SECRETS_KEY has changed');
    }
  }

  private need(): Buffer {
    if (!this.key) throw new Error('SECRETS_KEY is not set, so secrets cannot be stored or read');
    return this.key;
  }
}
