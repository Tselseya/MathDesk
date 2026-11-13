import { expect, test, type Page } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL || 'https://app.mathdesk.page.gd/';
const authEmail = process.env.E2E_AUTH_EMAIL;
const authPassword = process.env.E2E_AUTH_PASSWORD;
const signupName = process.env.E2E_SIGNUP_NAME || 'MathDesk E2E';
const signupEmail = process.env.E2E_SIGNUP_EMAIL;
const signupPassword = process.env.E2E_SIGNUP_PASSWORD;
const allowSignup = process.env.E2E_ALLOW_SIGNUP === 'true';
const captchaTimeout = Number(process.env.E2E_CAPTCHA_TIMEOUT_MS || 120_000);

async function openAuth(page: Page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /log in \/ sign up/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function waitForHumanCaptcha(page: Page) {
  const captcha = page.locator('iframe[title*="hCaptcha"], iframe[src*="hcaptcha"], .h-captcha');
  await expect(captcha.first()).toBeVisible({ timeout: 20_000 });
  if (process.env.E2E_SKIP_CAPTCHA_WAIT === 'true') return;
  console.log(`Complete the hCaptcha challenge in the headed browser within ${captchaTimeout}ms.`);
  await page.waitForFunction(() => {
    const response = document.querySelector<HTMLTextAreaElement>('textarea[name="h-captcha-response"]');
    return Boolean(response?.value);
  }, { timeout: captchaTimeout });
}

async function signOut(page: Page) {
  const signOutButton = page.getByRole('button', { name: /sign out/i });
  if (await signOutButton.isVisible().catch(() => false)) await signOutButton.click();
}

test.describe('MathDesk authentication', () => {
  test('login and signup surfaces render production hCaptcha', async ({ page }) => {
    await openAuth(page);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('iframe[src*="hcaptcha"], .h-captcha').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: /need an account/i }).click();
    await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
    await expect(page.locator('iframe[src*="hcaptcha"], .h-captcha').first()).toBeVisible({ timeout: 20_000 });
  });

  test('owner-run login succeeds with supplied test credentials', async ({ page }) => {
    test.skip(!authEmail || !authPassword, 'Set E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD to run the credentialed login test.');
    await openAuth(page);
    await page.getByLabel('Email').fill(authEmail!);
    await page.getByLabel('Password').fill(authPassword!);
    await waitForHumanCaptcha(page);
    await page.getByRole('button', { name: /^log in$/i }).click();
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible({ timeout: 30_000 });
    await signOut(page);
  });

  test('owner-run signup succeeds with supplied disposable test credentials', async ({ page }) => {
    test.skip(!allowSignup || !signupEmail || !signupPassword, 'Set E2E_ALLOW_SIGNUP=true, E2E_SIGNUP_EMAIL, and E2E_SIGNUP_PASSWORD to run signup.');
    await openAuth(page);
    await page.getByRole('button', { name: /need an account/i }).click();
    await page.getByLabel('Name').fill(signupName);
    await page.getByLabel('Email').fill(signupEmail!);
    await page.getByLabel('Password').fill(signupPassword!);
    await waitForHumanCaptcha(page);
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/check your email|sign out/i)).toBeVisible({ timeout: 30_000 });
    await signOut(page);
  });
});
