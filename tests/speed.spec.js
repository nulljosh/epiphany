import { test, expect } from '@playwright/test';

test('$1 → $1B in under 60 seconds', async ({ page }) => {
  test.setTimeout(180000); // 3 minute timeout
  // Go to production URL
  await page.goto('https://rise-production.vercel.app/');

  // Wait for app to load
  await page.waitForSelector('button:has-text("Start")');

  // Start timer
  const startTime = Date.now();

  // Click start button
  await page.click('button:has-text("Start")');

  // Wait for win condition (max 2 minutes timeout)
  await page.waitForSelector('text=$1B REACHED!', { timeout: 120000 });

  // Calculate elapsed time
  const elapsedTime = Date.now() - startTime;
  const elapsedSeconds = Math.floor(elapsedTime / 1000);

  console.log(`[INFO] Time to $1B: ${elapsedSeconds}s`);

  // Assert under 60 seconds
  expect(elapsedSeconds).toBeLessThan(60);
});
