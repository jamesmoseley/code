import { test, expect } from '@playwright/test';

test('Conditional flow based on presence of the word "dog" on CNN homepage', async ({ page }) => {
  // Navigate to CNN homepage
  await page.goto('https://www.cnn.com');
  // Click the "Agree" button to accept cookies (if it appears)
  await page.getByText('Agree', { exact: true }).click();
  // Get the full page text
  const pageText = await page.locator('body').innerText();

  // Check if the word "dog" appears anywhere on the page
  const containsDog = pageText.toLowerCase().includes('dog');

  if (containsDog) {
    console.log('The word "dog" was found on the page. Running Flow A...');
    
    // Example Flow A actions
    // (Replace these with whatever your real test needs to do)
    await page.click('text=World');  
    await expect(page).toHaveURL(/world/);

  } else {
    console.log('The word "dog" was NOT found on the page. Running Flow B...');
    
    // Example Flow B actions
    await expect(page).toHaveURL(/cnn/);
  }
});