import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHtmlReport } from 'axe-html-reporter';

test.describe('Accessibility Audit', () => {
  test('should not have any automatically detectable violations', async ({ page }) => {
    await page.goto('https://restful-booker.herokuapp.com');

    // Run the scan
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    // Generate HTML report
    createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: 'Accessibility Audit',
      },
    });

    // Assert that there are no violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});