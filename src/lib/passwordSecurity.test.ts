import { describe, expect, it } from 'vitest';
import { checkPasswordAgainstBreaches, getPasswordPolicyError } from './passwordSecurity';

async function sha1Hex(value: string) {
  const bytes = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

describe('password strength policy', () => {
  it('accepts passwords with length, uppercase, lowercase, number, and symbol', () => {
    expect(getPasswordPolicyError('MathDesk2026!')).toBeNull();
  });

  it.each([
    ['too short', 'Aa1!xyz'],
    ['no uppercase', 'mathdesk2026!'],
    ['no lowercase', 'MATHDESK2026!'],
    ['no number', 'MathDeskPassword!'],
    ['no symbol', 'MathDesk2026'],
  ])('rejects a password with %s', (_reason, password) => {
    expect(getPasswordPolicyError(password)).not.toBeNull();
  });
});

describe('password breach protection', () => {
  it('sends only the five-character hash prefix and detects a breached suffix', async () => {
    const password = 'password';
    const hash = await sha1Hex(password);
    const suffix = hash.slice(5);
    let requestedUrl = '';
    const result = await checkPasswordAgainstBreaches(password, async (input) => {
      requestedUrl = String(input);
      return new Response(`${suffix}:3861493\n`, { status: 200 });
    });

    expect(result).toBe('compromised');
    expect(requestedUrl).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
  });

  it('returns safe when the HIBP range does not include the password suffix', async () => {
    const result = await checkPasswordAgainstBreaches('a-new-long-password', async () => new Response('ABCDEF:1\n', { status: 200 }));
    expect(result).toBe('safe');
  });

  it('fails open when the breach service is unavailable', async () => {
    const result = await checkPasswordAgainstBreaches('a-new-long-password', async () => { throw new Error('offline'); });
    expect(result).toBe('unavailable');
  });
});
