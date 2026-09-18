import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const admin = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'admin',
  displayName: 'Local Administrator',
  mustChangePassword: false,
  roles: ['ADMIN'] as const,
};

const viewer = {
  id: '00000000-0000-0000-0000-000000000002',
  username: 'viewer',
  displayName: 'Read Only',
  mustChangePassword: false,
  roles: ['VIEWER'] as const,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('identity application', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in and shows role-aware navigation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json({
        accessToken: 'admin-token',
        tokenType: 'Bearer',
        expiresAt: '2026-09-19T00:00:00Z',
        user: admin,
      }),
    );

    render(<App />);
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '用户管理' })).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBe('admin-token');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows server errors with the request id', async () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json(
        {
          detail: 'Username or password is incorrect',
          errorCode: 'INVALID_CREDENTIALS',
          requestId: 'request-42',
        },
        401,
      ),
    );

    render(<App />);
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Username or password is incorrect');
    expect(screen.getByText('Request ID: request-42')).toBeInTheDocument();
  });

  it('forces first-login password change and validates confirmation', async () => {
    const firstLoginUser = { ...admin, mustChangePassword: true };
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json({
        accessToken: 'first-token',
        tokenType: 'Bearer',
        expiresAt: '2026-09-19T00:00:00Z',
        user: firstLoginUser,
      }),
    );

    render(<App />);
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(
      await screen.findByRole('heading', { name: '首次登录，请修改密码' }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'New-password-2026!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different-value' } });
    fireEvent.click(screen.getByRole('button', { name: '修改密码并继续' }));
    expect(screen.getByRole('alert')).toHaveTextContent('两次输入的新密码不一致');
  });

  it('changes the first-login password and replaces the session token', async () => {
    const firstLoginUser = { ...admin, mustChangePassword: true };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(
        json({
          accessToken: 'first-token',
          tokenType: 'Bearer',
          expiresAt: '2026-09-19T00:00:00Z',
          user: firstLoginUser,
        }),
      )
      .mockReturnValueOnce(
        json({
          accessToken: 'changed-token',
          tokenType: 'Bearer',
          expiresAt: '2026-09-19T00:15:00Z',
          user: admin,
        }),
      );

    render(<App />);
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    fireEvent.change(await screen.findByLabelText('当前密码'), {
      target: { value: 'Admin-local-2026!' },
    });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'New-password-2026!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), {
      target: { value: 'New-password-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: '修改密码并继续' }));

    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBe('changed-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('clears an invalid restored session and explains expiration', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'expired-token');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json(
        { detail: 'Session expired', errorCode: 'SESSION_INVALID', requestId: 'expired-1' },
        401,
      ),
    );

    render(<App />);

    expect(await screen.findByText('会话已过期，请重新登录。')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });

  it('blocks a non-admin deep link and hides the user menu', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'viewer-token');
    window.history.replaceState({}, '', '/users');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(viewer));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '无权访问' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '用户管理' })).not.toBeInTheDocument();
  });

  it('restores a valid session and logs out even when the logout request fails', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(admin))
      .mockRejectedValueOnce(new Error('network down'));

    render(<App />);
    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }));

    expect(await screen.findByRole('heading', { name: '登录控制台' })).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });

  it('shows a not-found state for an unknown authenticated route', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/missing');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(admin));

    render(<App />);

    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
  });

  it('loads an empty user page and creates a user through the real API client', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users');
    const createdUser = {
      ...viewer,
      enabled: true,
      mustChangePassword: true,
      createdAt: '2026-09-18T00:00:00Z',
      updatedAt: '2026-09-18T00:00:00Z',
    };
    let listCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) {
        return json(admin);
      }
      if (url.includes('/api/v1/users?')) {
        listCalls += 1;
        return json({
          content: listCalls === 1 ? [] : [createdUser],
          page: 0,
          size: 20,
          totalElements: listCalls === 1 ? 0 : 1,
          totalPages: listCalls === 1 ? 0 : 1,
        });
      }
      if (url.endsWith('/api/v1/users') && init?.method === 'POST') {
        return json(createdUser, 201);
      }
      return json({}, 404);
    });

    render(<App />);
    expect(await screen.findByText('没有符合条件的用户。')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '新增用户' }));
    fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'viewer' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Read Only' } });
    fireEvent.change(screen.getByLabelText('临时密码'), {
      target: { value: 'Viewer-local-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));

    expect(await screen.findByText('用户已创建，并要求首次登录修改密码。')).toBeInTheDocument();
    expect(screen.getByText('@viewer · 已启用')).toBeInTheDocument();
    await waitFor(() => expect(listCalls).toBe(2));
  });

  it('changes roles, resets a password and disables an existing user', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users');
    const managedViewer = {
      ...viewer,
      enabled: true,
      mustChangePassword: false,
      createdAt: '2026-09-18T00:00:00Z',
      updatedAt: '2026-09-18T00:00:00Z',
    };
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) {
        return json(admin);
      }
      if (url.includes('/api/v1/users?')) {
        return json({
          content: [managedViewer],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        });
      }
      methods.push(init?.method ?? 'GET');
      return json(managedViewer);
    });

    render(<App />);
    const card = await screen.findByRole('heading', { name: 'Read Only' });
    const userCard = card.closest('article');
    expect(userCard).not.toBeNull();
    const controls = within(userCard!);

    fireEvent.click(controls.getByLabelText('OPERATOR'));
    fireEvent.click(controls.getByRole('button', { name: '保存角色' }));
    await waitFor(() => expect(methods).toContain('PUT'));

    fireEvent.change(controls.getByLabelText('重置临时密码'), {
      target: { value: 'Reset-local-2026!' },
    });
    fireEvent.click(controls.getByRole('button', { name: '重置密码' }));
    await waitFor(() => expect(methods).toContain('POST'));

    fireEvent.click(controls.getByRole('button', { name: '禁用' }));
    fireEvent.click(controls.getByRole('button', { name: '确认禁用' }));
    await waitFor(() => expect(methods).toContain('PATCH'));
  });

  it('shows a recoverable user-list error with a fallback HTTP message', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(admin))
      .mockReturnValueOnce(Promise.resolve(new Response('broken', { status: 500 })));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Request failed with HTTP 500');
    expect(screen.getByText('没有符合条件的用户。')).toBeInTheDocument();
  });

  it('expires the session when user management receives an unauthorized response', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(admin))
      .mockReturnValueOnce(
        json(
          { detail: 'Session expired', errorCode: 'SESSION_INVALID', requestId: 'expired-users' },
          401,
        ),
      );

    render(<App />);

    expect(await screen.findByRole('heading', { name: '登录控制台' })).toBeInTheDocument();
    expect(screen.getByText('会话已过期，请重新登录。')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });
});
