import { test, expect } from '@playwright/test';
import { login, TEST_USER } from './helpers/auth';

test.describe('Settings and Preferences', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL('/');
  });

  test('user can navigate to settings page', async ({ page }) => {
    // Open menu - look for button in banner with fallback
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();

    // Wait for menu to open and click settings
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('menuitem', { name: /settings/i }).click();

    // Should navigate to settings page
    await expect(page).toHaveURL('/settings');
    await page.waitForLoadState('networkidle');
    
    // Verify settings page by checking for the form input
    await expect(page.getByLabel(/target industry/i)).toBeVisible({ timeout: 10000 });
  });

  test('user can fill in general preferences and save', async ({ page }) => {
    // Navigate to settings
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('menuitem', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
    await page.waitForLoadState('networkidle');

    // Wait for form to be ready
    await expect(page.getByLabel(/target industry/i)).toBeVisible({ timeout: 10000 });

    // Fill in general preferences using labels for more reliable selectors
    await page.getByLabel(/target industry/i).fill('Technology');
    
    // Company size - click the select trigger
    await page.getByLabel(/company size/i).click();
    await page.getByRole('option', { name: /201-1000 employees/i }).click();
    
    await page.getByLabel(/geographic region/i).fill('North America');
    await page.getByLabel(/target roles/i).fill('CEO, CTO, VP Engineering');
    
    // Revenue range
    await page.getByLabel(/annual revenue range/i).click();
    await page.getByRole('option', { name: /\$50M-100M/i }).click();
    
    await page.getByLabel(/keywords/i).fill('AI, Machine Learning, Cloud');
    await page.getByLabel(/additional notes/i).fill('Focus on enterprise customers');

    // Click save button
    await page.getByRole('button', { name: /save preferences/i }).click();

    // Wait for success toast
    await expect(page.getByText(/preferences saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify the save was successful - the toast confirms it
    // We don't need to verify form values immediately as they may reload
  });

  test('user can fill in LinkedIn search preferences and save', async ({ page }) => {
    // Navigate to settings
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('menuitem', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
    await page.waitForLoadState('networkidle');

    // Wait for form to be ready
    await expect(page.getByLabel(/target industry/i)).toBeVisible({ timeout: 10000 });

    // Scroll to LinkedIn section if needed
    const linkedinSection = page.getByRole('heading', { name: /linkedin profile search/i });
    await linkedinSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500); // Wait for scroll to complete

    // Fill in LinkedIn preferences using labels
    await page.getByLabel(/locations.*comma separated/i).fill('San Francisco, New York, London');
    await page.getByLabel(/positions.*comma separated/i).fill('CEO, CTO, VP Engineering');
    
    // Experience operator
    await page.getByLabel(/experience operator/i).click();
    await page.getByRole('option', { name: /greater than/i }).click();
    
    await page.getByLabel(/years of experience/i).fill('5');

    // Save preferences
    await page.getByRole('button', { name: /save preferences/i }).click();

    // Wait for success toast
    await expect(page.getByText(/preferences saved successfully/i)).toBeVisible({ timeout: 10000 });

    // Verify the save was successful - the toast confirms it
  });

  test('user can navigate back to dashboard from settings', async ({ page }) => {
    // Navigate to settings
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible({ timeout: 5000 });
    await page.getByRole('menuitem', { name: /settings/i }).click();
    await expect(page).toHaveURL('/settings');
    await page.waitForLoadState('networkidle');

    // Click back to dashboard button
    await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /back to dashboard/i }).click();

    // Should return to dashboard
    await expect(page).toHaveURL('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible({ timeout: 10000 });
  });
});

