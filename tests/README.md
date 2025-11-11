# Playwright Testing Guide

This project uses Playwright for end-to-end UI testing.

## Setup

1. **Install Playwright browsers** (if not already done):
   ```bash
   npx playwright install
   ```

2. **Install system dependencies** (if needed):
   ```bash
   npx playwright install-deps
   ```

## Running Tests

- **Run all tests**: `npm run test`
- **Run tests with UI mode** (interactive): `npm run test:ui`
- **Run tests in headed mode** (see browser): `npm run test:headed`
- **Debug tests**: `npm run test:debug`

## Test Structure

- `tests/example.spec.ts` - Basic example tests
- `tests/auth.spec.ts` - Authentication flow tests
- `tests/dashboard.spec.ts` - Dashboard tests
- `tests/helpers/` - Test helper functions

## Writing Tests with MCP

You can use MCP (Model Context Protocol) to generate tests. Ask the AI assistant to:
- "Write a Playwright test for [feature]"
- "Create a test that checks [scenario]"
- "Generate tests for the settings page"
- "Write a test for the LinkedIn search functionality"

The AI can analyze your components and generate comprehensive tests automatically.

## Test Helpers

Helper functions are available in `tests/helpers/`:
- `auth.ts` - Authentication helpers (login, signup, logout)

Example usage:
```typescript
import { login } from './helpers/auth';

test('should access dashboard after login', async ({ page }) => {
  await login(page, 'test@example.com', 'password');
  await expect(page.getByRole('heading', { name: /active leads/i })).toBeVisible();
});
```

## Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `http://localhost:8080` (or set `PLAYWRIGHT_TEST_BASE_URL` env var)
- Tests automatically start the dev server before running
- Screenshots and traces are captured on failures
- Tests run in Chromium, Firefox, and WebKit by default

## Environment Variables

Create a `.env.test` file for test-specific environment variables:
```
VITE_SUPABASE_URL=your_test_supabase_url
VITE_SUPABASE_ANON_KEY=your_test_anon_key
PLAYWRIGHT_TEST_BASE_URL=http://localhost:8080
```

## CI/CD Integration

Tests can be run in CI/CD pipelines. The configuration automatically:
- Retries failed tests (2 retries in CI)
- Runs tests serially in CI
- Captures traces and screenshots on failure
