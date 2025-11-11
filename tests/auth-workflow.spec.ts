import { test, expect } from '@playwright/test';
import { login, logout, TEST_USER } from './helpers/auth';

test.describe('Authentication Workflow', () => {
  test('user can login and navigate to home page', async ({ page }) => {
    // Start at login page
    await page.goto('/login');
    // Verify login page by checking for sign in tab and email input
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Login with test account
    await login(page, TEST_USER.email, TEST_USER.password);

    // Should be redirected to home page
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible();
  });

  test('user can access menu and logout', async ({ page }) => {
    // Login first
    await login(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL('/');
    await page.waitForLoadState('networkidle');

    // Open menu - wait for page to be ready, then find menu button
    // Use a more robust selector with fallback
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    
    // Wait for button to be visible and clickable
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    
    // Wait for dropdown menu to appear - wait for menu items to be visible
    await expect(page.getByRole('menuitem', { name: /home/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible();

    // Logout - menu is already open, so logout function will handle it
    await logout(page);

    // Should be redirected to login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible();
  });

  test('complete authentication workflow: login -> navigate -> logout', async ({ page }) => {
    // Step 1: Login
    await page.goto('/login');
    await login(page, TEST_USER.email, TEST_USER.password);

    // Step 2: Verify on home page
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible();

    // Step 3: Open menu and verify options
    let menuButton = page.getByRole('banner').getByRole('button').first();
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    await expect(page.getByRole('menuitem', { name: /sign out/i })).toBeVisible({ timeout: 5000 });

    // Step 4: Logout
    await page.getByRole('menuitem', { name: /sign out/i }).click();

    // Step 5: Verify redirected to login
    await expect(page).toHaveURL(/.*login/);
    // Verify login page by checking for sign in tab or email input
    // Try sign in tab first, fallback to email input
    try {
      await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible({ timeout: 2000 });
    } catch {
      await expect(page.getByLabel(/email/i)).toBeVisible();
    }
  });
});

