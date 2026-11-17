import { expect, test } from '@playwright/test';

const baseUrl = process.env.E2E_BASE_URL || 'https://app.mathdesk.page.gd/';

test('chat conversations expose an accessible toggle group and focusable history', async ({ page }) => {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /open ai chatbox/i }).click();

  const conversationGroup = page.getByRole('group', { name: 'Conversations' });
  await expect(conversationGroup).toBeVisible();
  await expect(page.locator('[role="tablist"]')).toHaveCount(0);
  await expect(conversationGroup.locator('.legacy-new-tab')).toBeVisible();
  await expect(conversationGroup.locator('.legacy-tab[aria-pressed="true"]')).toHaveCount(1);
  await expect(conversationGroup.locator('.legacy-tab-close')).toHaveCount(1);

  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'MathDesk AI' })).toBeVisible();
  await expect(page.locator('.legacy-sidebar-history')).toHaveAttribute('tabindex', '0');
});
