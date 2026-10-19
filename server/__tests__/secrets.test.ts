import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretBox } from '../src/secrets';

const key = () => randomBytes(32).toString('base64');

describe('secret box', () => {
  it('opens what it sealed, differently each time', () => {
    const box = new SecretBox(key());
    const a = box.encrypt('hunter2');
    expect(a).toMatch(/^v1:/);
    expect(a).not.toContain('hunter2');
    expect(box.encrypt('hunter2')).not.toBe(a);
    expect(box.decrypt(a)).toBe('hunter2');
  });

  it('refuses another key, a tampered secret, and working without a key', () => {
    const sealed = new SecretBox(key()).encrypt('hunter2');
    expect(() => new SecretBox(key()).decrypt(sealed)).toThrow('SECRETS_KEY has changed');
    const box = new SecretBox(key());
    const mine = box.encrypt('hunter2');
    const bytes = Buffer.from(mine.slice(3), 'base64');
    bytes[bytes.length - 1]! ^= 1;
    expect(() => box.decrypt(`v1:${bytes.toString('base64')}`)).toThrow();
    expect(() => new SecretBox(undefined).encrypt('x')).toThrow('SECRETS_KEY is not set');
    expect(() => new SecretBox('c2hvcnQ=')).toThrow('32 bytes');
  });
});
