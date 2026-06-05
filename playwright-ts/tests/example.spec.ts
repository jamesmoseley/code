import { test, expect } from '@playwright/test';

test('Simple Get request', async ({ request }) => {
  await request.get('https://jsonplaceholder.typicode.com/todos/1');
  // Expect a endpoint "to contain" a substring.
  const response = await request.get('https://jsonplaceholder.typicode.com/todos/1');
  const responseObject = await response.json();
  expect(responseObject.title).toContain('delectus aut autem');
  // await expect(request).toHaveTitle(/Playwright/);
});

test('get started link', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
});
