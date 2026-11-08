import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ auth: mocks.auth })),
}));

describe('Supabase auth hCaptcha forwarding', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-anon-key');
    vi.clearAllMocks();
    mocks.auth.signInWithPassword.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    mocks.auth.signUp.mockResolvedValue({ data: { session: {}, user: {} }, error: null });
    mocks.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    vi.stubGlobal('window', { location: { origin: 'https://app.mathdesk.page.gd' } });
  });

  it('passes the mocked token to password login', async () => {
    const { signIn } = await import('./supabase');
    await signIn('learner@example.com', 'correct-password', 'mock-hcaptcha-token');

    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'learner@example.com',
      password: 'correct-password',
      options: { captchaToken: 'mock-hcaptcha-token' },
    });
  });

  it('passes the mocked token to signup', async () => {
    const { signUp } = await import('./supabase');
    await signUp('Learner', 'learner@example.com', 'correct-password', 'mock-hcaptcha-token');

    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'learner@example.com',
      password: 'correct-password',
      options: { data: { name: 'Learner' }, captchaToken: 'mock-hcaptcha-token' },
    });
  });

  it('passes the mocked token to password reset', async () => {
    const { requestPasswordReset } = await import('./supabase');
    await requestPasswordReset('learner@example.com', 'mock-hcaptcha-token');

    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('learner@example.com', {
      redirectTo: 'https://app.mathdesk.page.gd/',
      captchaToken: 'mock-hcaptcha-token',
    });
  });
});
