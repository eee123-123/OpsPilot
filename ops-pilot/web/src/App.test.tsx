import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, GlobalErrorBoundary } from './App';

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

function json(body: unknown, status = 200, requestId = 'request-test') {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'X-Request-ID': requestId },
    }),
  );
}

function loginResponse(user = admin) {
  return {
    accessToken: 'access-token',
    tokenType: 'Bearer',
    expiresAt: '2026-09-19T00:00:00Z',
    user,
  };
}

describe('frontend foundation application', () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in and renders navigation, breadcrumbs and the user menu', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(json(loginResponse()));
    render(<App />);

    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
    expect(screen.getAllByText('系统概览')).toHaveLength(2);
    expect(screen.getByText('体验基线')).toBeInTheDocument();
    expect(screen.getByText('用户管理')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Local Administrator/ })).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBe('access-token');
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('X-Request-ID')).toMatch(/[0-9a-f-]{36}/);
  });

  it('shows a Problem Details message and request id for failed login', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Username or password is incorrect');
    expect(screen.getByText('Request ID: request-42')).toBeInTheDocument();
  });

  it('validates first-login password confirmation before calling the API', async () => {
    const firstLogin = { ...admin, mustChangePassword: true };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(json(loginResponse(firstLogin)));
    render(<App />);
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByText('首次登录，请修改密码')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('当前密码'), { target: { value: 'Admin-local-2026!' } });
    fireEvent.change(screen.getByLabelText('新密码'), { target: { value: 'New-password-2026!' } });
    fireEvent.change(screen.getByLabelText('确认新密码'), { target: { value: 'different-value' } });
    fireEvent.click(screen.getByRole('button', { name: '修改密码并继续' }));

    expect(await screen.findByText('两次输入的新密码不一致。')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('clears an invalid restored session and explains expiration', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'expired-token');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(
      json({ detail: 'Session expired', errorCode: 'SESSION_INVALID' }, 401),
    );
    render(<App />);

    expect(await screen.findByText('会话已过期，请重新登录。')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });

  it('blocks a non-admin deep link and hides user management', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'viewer-token');
    window.history.replaceState({}, '', '/users');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(viewer));
    render(<App />);

    expect(await screen.findByRole('heading', { name: '无权访问' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /用户管理/ })).not.toBeInTheDocument();
  });

  it('renders the dedicated 404 page and returns home', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/missing');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(admin));
    render(<App />);

    expect(await screen.findByRole('heading', { name: '页面不存在' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    expect(await screen.findByText('欢迎，Local Administrator')).toBeInTheDocument();
  });

  it('syncs user filters with the URL and renders an empty server page', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?page=0&size=10');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      return json({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
    });
    render(<App />);

    expect(await screen.findByText('没有符合条件的用户')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索用户'), { target: { value: 'viewer' } });
    fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }));
    await waitFor(() => expect(window.location.search).toContain('query=viewer'));
  });

  it('automatically attaches JWT credentials to authenticated requests', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(json(admin));
    render(<App />);

    await screen.findByText('欢迎，Local Administrator');
    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer admin-token');
  });

  it('changes a first-login password and replaces the access token', async () => {
    const firstLogin = { ...admin, mustChangePassword: true };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(loginResponse(firstLogin)))
      .mockReturnValueOnce(json({ ...loginResponse(admin), accessToken: 'changed-token' }));
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

  it('logs out locally when the server logout request fails', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(admin))
      .mockRejectedValueOnce(new Error('network down'));
    render(<App />);
    await screen.findByText('欢迎，Local Administrator');
    fireEvent.click(screen.getByRole('button', { name: /Local Administrator/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: '退出登录' }));

    expect(await screen.findByText('登录控制台')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });

  it('shows the component foundation and confirms a danger prompt', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(admin));
    render(<App />);
    await screen.findByText('欢迎，Local Administrator');
    fireEvent.click(screen.getByRole('menuitem', { name: /体验基线/ }));

    expect(await screen.findByRole('heading', { name: '统一体验组件' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '查看危险操作确认' }));
    expect(
      await screen.findByText('本对话框只演示二次确认规范，不会调用后端或改变数据。'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认执行' }));
  });

  it('expires the whole session when an authenticated request returns 401', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=unauthorized');
    vi.spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(json(admin))
      .mockReturnValueOnce(json({ detail: 'expired', errorCode: 'SESSION_INVALID' }, 401));
    render(<App />);

    expect(await screen.findByText('会话已过期，请重新登录。')).toBeInTheDocument();
    expect(sessionStorage.getItem('ops-pilot.access-token')).toBeNull();
  });

  it('creates a user with validated fields and refreshes the server table', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=create');
    const created = {
      ...viewer,
      enabled: true,
      mustChangePassword: true,
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:00Z',
    };
    let createdOnce = false;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      if (url.endsWith('/api/v1/users') && init?.method === 'POST') {
        createdOnce = true;
        return json(created, 201);
      }
      if (!init?.method || init.method === 'GET') {
        return json({
          content: createdOnce ? [created] : [],
          page: 0,
          size: 10,
          totalElements: createdOnce ? 1 : 0,
          totalPages: 1,
        });
      }
      return json({}, 404);
    });
    render(<App />);
    await screen.findByText('没有符合条件的用户');
    fireEvent.click(screen.getByRole('button', { name: '新增用户' }));
    fireEvent.change(await screen.findByLabelText('用户名'), { target: { value: 'viewer' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: 'Read Only' } });
    fireEvent.change(screen.getByLabelText('临时密码'), {
      target: { value: 'Viewer-local-2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建用户' }));

    expect(await screen.findByText('@viewer')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });

  it('updates user roles', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=role-action');
    const enabledUser = {
      ...viewer,
      enabled: true,
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:00Z',
    };
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      if (!init?.method || init.method === 'GET') {
        return json({
          content: [enabledUser],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        });
      }
      methods.push(init?.method ?? 'GET');
      return json(enabledUser);
    });
    render(<App />);
    await screen.findByText('@viewer');

    fireEvent.click(screen.getAllByRole('button', { name: '编辑角色' })[0]!);
    fireEvent.click(await screen.findByLabelText('OPERATOR'));
    fireEvent.click(screen.getByRole('button', { name: '保存角色' }));
    await waitFor(() => expect(methods).toContain('PUT'));
  });

  it('resets a user password', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=password-action');
    const enabledUser = {
      ...viewer,
      enabled: true,
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:00Z',
    };
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      if (!init?.method || init.method === 'GET') {
        return json({
          content: [enabledUser],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        });
      }
      methods.push(init?.method ?? 'GET');
      return json(enabledUser);
    });
    render(<App />);
    await screen.findByText('@viewer');

    fireEvent.click(screen.getAllByRole('button', { name: '重置密码' })[0]!);
    const passwordDialog = await screen.findByRole('dialog');
    fireEvent.change(within(passwordDialog).getByLabelText('临时密码'), {
      target: { value: 'Reset-local-2026!' },
    });
    fireEvent.click(within(passwordDialog).getByRole('button', { name: '重置密码' }));
    await waitFor(() => expect(methods).toContain('POST'));
  });

  it('disables and enables users', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=status-action');
    const enabledUser = {
      ...viewer,
      enabled: true,
      createdAt: '2026-09-19T00:00:00Z',
      updatedAt: '2026-09-19T00:00:00Z',
    };
    const disabledUser = {
      ...enabledUser,
      id: '00000000-0000-0000-0000-000000000003',
      username: 'disabled',
      displayName: 'Disabled User',
      enabled: false,
    };
    const methods: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      if (!init?.method || init.method === 'GET') {
        return json({
          content: [enabledUser, disabledUser],
          page: 0,
          size: 10,
          totalElements: 2,
          totalPages: 1,
        });
      }
      methods.push(init?.method ?? 'GET');
      return json(enabledUser);
    });
    render(<App />);
    await screen.findByText('@viewer');

    fireEvent.click(screen.getByRole('button', { name: '禁用' }));
    fireEvent.click(await screen.findByRole('button', { name: '确认禁用' }));
    await waitFor(() => expect(methods).toContain('PATCH'));

    fireEvent.click(screen.getByRole('button', { name: '启用' }));
    await waitFor(() => expect(methods.filter((method) => method === 'PATCH')).toHaveLength(2));
  });

  it('shows a recoverable user-list error and supports pagination state', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/users?query=recoverable');
    let listCalls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/me')) return json(admin);
      listCalls += 1;
      if (listCalls <= 2) return json({ detail: 'Database unavailable', requestId: 'db-1' }, 500);
      return json({
        content: [],
        page: 0,
        size: 10,
        totalElements: 21,
        totalPages: 3,
      });
    });
    render(<App />);
    expect(await screen.findByText('Request ID: db-1', {}, { timeout: 4_000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await screen.findByText('没有符合条件的用户');
    fireEvent.click(screen.getByTitle('2'));
    await waitFor(() => expect(window.location.search).toContain('page=1'));
  });

  it('renders the explicit 500 route', async () => {
    sessionStorage.setItem('ops-pilot.access-token', 'admin-token');
    window.history.replaceState({}, '', '/error');
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json(admin));
    render(<App />);
    expect(await screen.findByRole('heading', { name: '页面加载失败' })).toBeInTheDocument();
  });

  it('catches unexpected render errors and lets the user recover', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error('unexpected render failure');
    }
    render(
      <GlobalErrorBoundary>
        <Broken />
      </GlobalErrorBoundary>,
    );
    expect(screen.getByRole('heading', { name: '应用发生异常' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
  });
});
