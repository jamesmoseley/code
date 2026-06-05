// Minimal Playwright Test so the runner can discover tests in `scripts/`
import { test, expect } from '@playwright/test';

test('Google.com has expected title', async ({ page }) => {
  await page.goto('https://google.com');
  await expect(page).toHaveTitle(/google/i);
});
