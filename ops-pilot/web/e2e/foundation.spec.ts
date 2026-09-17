import { expect, test } from '@playwright/test';

test('shows the engineering foundation and backend health', async ({ page }) => {
  await page.route('**/actuator/health', async (route) => {
    await route.fulfill({ json: { status: 'UP' } });
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'OpsPilot' })).toBeVisible();
  await expect(page.getByText('运行正常')).toBeVisible();
  await expect(page.getByRole('heading', { name: '工程基础已就绪' })).toBeVisible();
});
