import { Page, expect } from '@playwright/test';

/**
 * Helper functions for authentication in tests
 */

export const TEST_USER = {
  email: 'test@swann.com',
  password: 'password',
};

export async function login(page: Page, email: string = TEST_USER.email, password: string = TEST_USER.password) {
  await page.goto('/login');

  // Ensure we're on the sign in tab
  const signInTab = page.getByRole('tab', { name: /sign in/i });
  if (await signInTab.isVisible()) {
    await signInTab.click();
  }

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for navigation after login and success toast
  await page.waitForURL('/', { timeout: 10000 });
  // Wait a bit for the page to fully load
  await page.waitForLoadState('networkidle');
}

export async function signUp(
  page: Page,
  email: string,
  password: string,
  fullName: string
) {
  await page.goto('/login');
  // Switch to sign up tab
  await page.getByRole('tab', { name: /sign up/i }).click();
  await page.getByLabel(/full name/i).fill(fullName);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();
}

export async function logout(page: Page) {
  // Open menu - wait for the page to be fully loaded first
  await page.waitForLoadState('networkidle');
  
  // Check if menu is already open - if Sign Out is visible, menu is open
  const signOutMenuItem = page.getByRole('menuitem', { name: /sign out/i });
  const isMenuOpen = await signOutMenuItem.isVisible().catch(() => false);
  
  if (!isMenuOpen) {
    // Menu is not open, so we need to click the menu button
    // Use a more robust selector - try banner first, fallback to header
    let menuButton = page.getByRole('banner').getByRole('button').first();
    
    // Check if button exists, if not try alternative selector
    const buttonCount = await menuButton.count();
    if (buttonCount === 0) {
      // Fallback: use locator to find button with SVG in header/banner
      menuButton = page.locator('header button, banner button').filter({ has: page.locator('svg') }).first();
    }
    
    // Wait for button to be visible and clickable
    await expect(menuButton).toBeVisible({ timeout: 10000 });
    await menuButton.click();
    
    // Wait for dropdown menu to appear
    await expect(signOutMenuItem).toBeVisible({ timeout: 5000 });
  }
  
  // Click sign out
  await signOutMenuItem.click();
  
  // Wait for redirect to login
  await page.waitForURL(/.*login/, { timeout: 10000 });
  // Verify login page by checking for sign in tab
  await expect(page.getByRole('tab', { name: /sign in/i })).toBeVisible({ timeout: 5000 });
}

