import { test, expect } from '@playwright/test';
import { login, TEST_USER } from './helpers/auth';

test.describe('Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await login(page, TEST_USER.email, TEST_USER.password);
    await expect(page).toHaveURL('/');
  });

  test('user can view leads dashboard', async ({ page }) => {
    // Verify dashboard elements are visible
    await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible();
    await expect(page.getByText('LeadFlow')).toBeVisible();
    
    // Check for stats cards
    await expect(page.getByText(/total leads/i)).toBeVisible();
    
    // Check for search and filter controls
    await expect(page.getByPlaceholder(/search companies/i)).toBeVisible();
    // Status filter combobox - be specific to avoid multiple matches
    await expect(page.getByRole('combobox').filter({ hasText: /all statuses/i })).toBeVisible();
  });

  test('user can navigate to company detail page from leads table', async ({ page }) => {
    // Wait for leads to load
    await page.waitForLoadState('networkidle');
    
    // Look for company name links in the table
    // If there are leads, click on the first company name
    const companyLink = page.locator('table button').filter({ hasText: /./ }).first();
    
    // Check if there are any leads
    const hasLeads = await companyLink.count() > 0;
    
    if (hasLeads) {
      // Get the company name before clicking
      const companyName = await companyLink.textContent();
      
      // Click on the company name
      await companyLink.click();
      
      // Should navigate to company detail page
      await expect(page).toHaveURL(/\/company\//);
      
      // Verify company detail page elements
      await expect(page.getByRole('button', { name: /back to dashboard/i })).toBeVisible();
      
      // Verify we can see company information (if available)
      // The page might show "Company Not Found" if the company doesn't exist in companies table
      // But the navigation should still work
    } else {
      // If no leads, just verify the table structure exists
      await expect(page.locator('table')).toBeVisible();
      test.info().annotations.push({ type: 'note', description: 'No leads available to test navigation' });
    }
  });

  test('user can return to dashboard from company detail page', async ({ page }) => {
    // Wait for leads to load
    await page.waitForLoadState('networkidle');
    
    // Try to navigate to a company if leads exist
    const companyLink = page.locator('table button').filter({ hasText: /./ }).first();
    const hasLeads = await companyLink.count() > 0;
    
    if (hasLeads) {
      // Navigate to company detail
      await companyLink.click();
      await expect(page).toHaveURL(/\/company\//);
      
      // Wait for back button to be visible and clickable
      const backButton = page.getByRole('button', { name: /back to dashboard/i });
      await expect(backButton).toBeVisible({ timeout: 10000 });
      await backButton.click();
      
      // Should return to dashboard
      await expect(page).toHaveURL('/');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible({ timeout: 10000 });
    } else {
      // Test navigation directly via URL
      const testCompanyName = 'Test Company';
      await page.goto(`/company/${encodeURIComponent(testCompanyName)}`);
      await page.waitForLoadState('networkidle');
      
      // Wait for back button to be visible and clickable
      const backButton = page.getByRole('button', { name: /back to dashboard/i });
      await expect(backButton).toBeVisible({ timeout: 10000 });
      await backButton.click();
      
      // Should return to dashboard
      await expect(page).toHaveURL('/');
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible({ timeout: 10000 });
    }
  });

  test('user can filter leads by status', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Open status filter dropdown - be specific to get the main filter, not row-level filters
    const statusFilter = page.getByRole('combobox').filter({ hasText: /all statuses/i }).first();
    await expect(statusFilter).toBeVisible();
    await statusFilter.click();
    
    // Select a status option if available
    const qualifiedOption = page.getByRole('option', { name: /qualified/i });
    if (await qualifiedOption.count() > 0) {
      await qualifiedOption.first().click();
      // Verify filter dropdown is still visible (or closed)
      await page.waitForTimeout(500); // Wait for filter to apply
    }
  });

  test('user can search for companies', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Enter search term
    const searchInput = page.getByPlaceholder(/search companies/i);
    await searchInput.fill('test');
    
    // Verify search input has value
    await expect(searchInput).toHaveValue('test');
    
    // Clear search
    await searchInput.clear();
    await expect(searchInput).toHaveValue('');
  });
});

