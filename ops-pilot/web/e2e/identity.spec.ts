import { expect, test } from '@playwright/test';

test('admin can login and open user management', async ({ page }) => {
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: {
        accessToken: 'admin-token',
        tokenType: 'Bearer',
        expiresAt: '2026-09-19T00:00:00Z',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          username: 'admin',
          displayName: 'Local Administrator',
          mustChangePassword: false,
          roles: ['ADMIN'],
        },
      },
    });
  });
  await page.route('**/api/v1/users?**', async (route) => {
    await route.fulfill({
      json: { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 },
    });
  });

  await page.goto('/');
  await page.getByLabel('用户名').fill('admin');
  await page.getByLabel('密码').fill('Admin-local-2026!');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByText('欢迎，Local Administrator')).toBeVisible();
  await page.getByRole('button', { name: '用户管理' }).click();
  await expect(page.getByRole('heading', { name: '用户与角色' })).toBeVisible();
  await expect(page.getByText('没有符合条件的用户。')).toBeVisible();
});

test('viewer cannot see or deep-link to user management', async ({ page }) => {
  const viewer = {
    id: '00000000-0000-0000-0000-000000000002',
    username: 'viewer',
    displayName: 'Read Only',
    mustChangePassword: false,
    roles: ['VIEWER'],
  };
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      json: {
        accessToken: 'viewer-token',
        tokenType: 'Bearer',
        expiresAt: '2026-09-19T00:00:00Z',
        user: viewer,
      },
    });
  });
  await page.route('**/api/v1/auth/me', async (route) => route.fulfill({ json: viewer }));

  await page.goto('/');
  await page.getByLabel('用户名').fill('viewer');
  await page.getByLabel('密码').fill('Viewer-local-2026!');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page.getByRole('button', { name: '用户管理' })).toHaveCount(0);
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();
});
