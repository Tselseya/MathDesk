import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './AuthPanel';

describe('friendlyAuthError', () => {
  it('identifies Supabase CAPTCHA rejection instead of reporting a network failure', () => {
    expect(friendlyAuthError({ code: 'captcha_failed', message: 'captcha protection: request disallowed (no captcha_token found)' }, 'login'))
      .toContain('CAPTCHA protection');
  });
});
