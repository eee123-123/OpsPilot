import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_LIVE !== 'true', 'requires the isolated Compose API');

test('real API supports first-login change and enforces viewer permissions', async ({ page }) => {
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD ?? 'Admin-local-2026!';
  const changedAdminPassword = 'Admin-e2e-changed-2026!';
  const viewerTemporaryPassword = 'Viewer-e2e-temp-2026!';
  const viewerChangedPassword = 'Viewer-e2e-changed-2026!';

  await page.goto('/');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill(initialAdminPassword);
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByRole('heading', { name: '首次登录，请修改密码' })).toBeVisible();
  await page.getByLabel('当前密码').fill(initialAdminPassword);
  await page.getByLabel('新密码', { exact: true }).fill(changedAdminPassword);
  await page.getByLabel('确认新密码').fill(changedAdminPassword);
  await page.getByRole('button', { name: '修改密码并继续' }).click();

  await expect(page.getByText('欢迎，Local Administrator')).toBeVisible();
  await page.getByRole('button', { name: '用户管理' }).click();
  await page.getByRole('button', { name: '新增用户' }).click();
  await page.getByLabel('用户名').fill('viewer-e2e');
  await page.getByLabel('显示名称').fill('E2E Viewer');
  await page.getByLabel('临时密码', { exact: true }).fill(viewerTemporaryPassword);
  await page.getByRole('button', { name: '创建用户' }).click();
  await expect(page.getByText('用户已创建，并要求首次登录修改密码。')).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await page.getByLabel('用户名').fill('viewer-e2e');
  await page.getByLabel('密码').fill(viewerTemporaryPassword);
  await page.getByRole('button', { name: '登录' }).click();
  await page.getByLabel('当前密码').fill(viewerTemporaryPassword);
  await page.getByLabel('新密码', { exact: true }).fill(viewerChangedPassword);
  await page.getByLabel('确认新密码').fill(viewerChangedPassword);
  await page.getByRole('button', { name: '修改密码并继续' }).click();

  await expect(page.getByText('欢迎，E2E Viewer')).toBeVisible();
  await expect(page.getByRole('button', { name: '用户管理' })).toHaveCount(0);
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();

  const forbidden = await page.request.get('http://127.0.0.1:8080/api/v1/users', {
    headers: {
      Authorization: `Bearer ${await page.evaluate(() => sessionStorage.getItem('ops-pilot.access-token'))}`,
    },
  });
  expect(forbidden.status()).toBe(403);
});
