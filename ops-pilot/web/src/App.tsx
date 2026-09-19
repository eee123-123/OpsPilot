import {
  ApiOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  App as AntApp,
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Checkbox,
  ConfigProvider,
  Dropdown,
  Form,
  Input,
  Layout,
  Menu,
  Modal,
  Select,
  Space,
  Statistic,
  Typography,
  theme,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  keepPreviousData,
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from '@tanstack/react-query';
import {
  Component,
  type ErrorInfo,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  ApiError,
  configureApiSession,
  type CurrentUser,
  identityApi,
  type LoginResponse,
  type ManagedUser,
  type RoleName,
} from './api';
import {
  Confidence,
  ContentViewer,
  DangerousActionDialog,
  PageLoading,
  RequestError,
  RiskTag,
  RouteStatus,
  ServerTable,
  StatusTag,
} from './components/foundation';

const { Content, Header, Sider } = Layout;
const { Paragraph, Text, Title } = Typography;
const sessionKey = 'ops-pilot.access-token';
const roles: RoleName[] = ['VIEWER', 'OPERATOR', 'APPROVER', 'ADMIN'];
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
    mutations: { retry: false },
  },
});

type Session = { token: string; user: CurrentUser };

function saveToken(token: string) {
  sessionStorage.setItem(sessionKey, token);
}

function clearToken() {
  sessionStorage.removeItem(sessionKey);
  queryClient.clear();
}

export function App() {
  return (
    <ConfigProvider
      button={{ autoInsertSpace: false }}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#48cae4',
          colorBgBase: '#07111f',
          colorBgContainer: '#0d1d2e',
          borderRadius: 10,
          fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        },
      }}
    >
      <AntApp>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <GlobalErrorBoundary>
              <SessionRouter />
            </GlobalErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>
  );
}

function SessionRouter() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(() => sessionStorage.getItem(sessionKey) !== null);
  const [expired, setExpired] = useState(false);

  function expireSession() {
    clearToken();
    setSession(null);
    setExpired(true);
    navigate('/login', { replace: true });
  }

  configureApiSession({
    token: () => sessionStorage.getItem(sessionKey),
    onUnauthorized: expireSession,
  });

  useEffect(() => {
    if (!sessionStorage.getItem(sessionKey)) {
      return;
    }
    let active = true;
    identityApi
      .me()
      .then((user) => {
        if (active) {
          setSession({ token: sessionStorage.getItem(sessionKey) ?? '', user });
        }
      })
      .catch(() => {
        clearToken();
        if (active) {
          setExpired(true);
        }
      })
      .finally(() => {
        if (active) {
          setRestoring(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function acceptSession(response: LoginResponse) {
    saveToken(response.accessToken);
    setSession({ token: response.accessToken, user: response.user });
    setExpired(false);
  }

  if (restoring) {
    return <PageLoading rows={5} />;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage expired={expired} onLogin={acceptSession} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (session.user.mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage onChanged={acceptSession} />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        element={
          <ConsoleLayout
            user={session.user}
            onLogout={() => {
              clearToken();
              setSession(null);
              navigate('/login', { replace: true });
            }}
          />
        }
      >
        <Route index element={<Dashboard user={session.user} />} />
        <Route
          path="users"
          element={
            session.user.roles.includes('ADMIN') ? (
              <UserManagementPage currentUser={session.user} />
            ) : (
              <ForbiddenPage />
            )
          }
        />
        <Route path="foundation" element={<FoundationPage user={session.user} />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="error" element={<ServerErrorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function LoginPage({
  expired,
  onLogin,
}: {
  expired: boolean;
  onLogin: (response: LoginResponse) => void;
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>();
  const login = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      identityApi.login(username, password),
    onSuccess: (response) => {
      onLogin(response);
      navigate(response.user.mustChangePassword ? '/change-password' : '/', { replace: true });
    },
    onError: setError,
  });
  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <Text className="eyebrow">INTELLIGENT INCIDENT OPERATIONS</Text>
        <Title>OpsPilot</Title>
        <Paragraph>可审计、可恢复、证据优先的智能故障诊断与应急处置平台。</Paragraph>
      </section>
      <Card className="auth-card" aria-labelledby="login-title">
        <Text className="section-kicker">SECURE ACCESS</Text>
        <Title level={2} id="login-title">
          登录控制台
        </Title>
        {expired && <Alert showIcon type="warning" title="会话已过期，请重新登录。" />}
        {error !== undefined && <RequestError error={error} title="登录失败" />}
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={(values: { username: string; password: string }) => login.mutate(values)}
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input autoComplete="username" maxLength={64} />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password autoComplete="current-password" maxLength={128} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={login.isPending}>
            登录
          </Button>
        </Form>
      </Card>
    </main>
  );
}

function ChangePasswordPage({ onChanged }: { onChanged: (response: LoginResponse) => void }) {
  const navigate = useNavigate();
  const [error, setError] = useState<unknown>();
  const changePassword = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      identityApi.changePassword(values.currentPassword, values.newPassword),
    onSuccess: (response) => {
      onChanged(response);
      navigate('/', { replace: true });
    },
    onError: setError,
  });
  return (
    <main className="auth-shell auth-shell-single">
      <Card className="auth-card" aria-labelledby="change-password-title">
        <Text className="section-kicker">FIRST LOGIN</Text>
        <Title level={2} id="change-password-title">
          首次登录，请修改密码
        </Title>
        <Paragraph type="secondary">新密码需为 12–128 位，并包含大小写字母、数字和符号。</Paragraph>
        {error !== undefined && <RequestError error={error} title="修改密码失败" />}
        <Form
          layout="vertical"
          requiredMark={false}
          onFinish={(values: {
            currentPassword: string;
            newPassword: string;
            confirmation: string;
          }) => changePassword.mutate(values)}
        >
          <Form.Item label="当前密码" name="currentPassword" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[{ required: true }, { min: 12, message: '至少输入 12 个字符' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmation"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的新密码不一致。'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={changePassword.isPending}>
            修改密码并继续
          </Button>
        </Form>
      </Card>
    </main>
  );
}

function ConsoleLayout({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '系统概览' },
    { key: '/foundation', icon: <ApiOutlined />, label: '体验基线' },
    ...(user.roles.includes('ADMIN')
      ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }]
      : []),
  ];
  const breadcrumbNames: Record<string, string> = {
    '/': '系统概览',
    '/foundation': '体验基线',
    '/users': '用户管理',
    '/forbidden': '无权访问',
    '/error': '服务异常',
  };

  async function logout() {
    try {
      await identityApi.logout();
    } catch {
      // Browser state still has to be cleared when the API is unavailable.
    } finally {
      onLogout();
    }
  }

  return (
    <Layout className="console-layout">
      <Sider collapsible collapsed={collapsed} trigger={null} width={240} className="console-sider">
        <button className="brand-button" type="button" onClick={() => navigate('/')}>
          {collapsed ? 'OP' : 'OpsPilot'}
        </button>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="console-header">
          <Button
            type="text"
            aria-label={collapsed ? '展开导航' : '收起导航'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((value) => !value)}
          />
          <Breadcrumb
            items={[
              { title: 'OpsPilot' },
              { title: breadcrumbNames[location.pathname] ?? '页面不存在' },
            ]}
          />
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'identity', label: user.roles.join(' · '), disabled: true },
                { type: 'divider' },
                { key: 'logout', label: '退出登录', onClick: () => void logout() },
              ],
            }}
          >
            <Button type="text" className="user-menu">
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user.displayName}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content className="console-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

function Dashboard({ user }: { user: CurrentUser }) {
  return (
    <section>
      <Text className="section-kicker">IDENTITY FOUNDATION</Text>
      <Title>欢迎，{user.displayName}</Title>
      <Paragraph type="secondary" className="page-lead">
        统一导航、会话恢复、请求追踪与异常处理已经就绪，后续业务模块可以复用同一体验基线。
      </Paragraph>
      <div className="stat-grid">
        <Card>
          <Statistic
            title="当前角色"
            value={user.roles.length}
            prefix={<SafetyCertificateOutlined />}
          />
        </Card>
        <Card>
          <Statistic title="会话状态" value="已认证" />
        </Card>
        <Card>
          <Statistic title="Request ID" value="全链路启用" />
        </Card>
      </div>
      <Card title="权限摘要" className="surface-card">
        <Space wrap>
          {roles.map((role) => (
            <StatusTag key={role} status={user.roles.includes(role) ? role : `${role} · 未授予`} />
          ))}
        </Space>
      </Card>
    </section>
  );
}

function FoundationPage({ user }: { user: CurrentUser }) {
  const [dangerOpen, setDangerOpen] = useState(false);
  return (
    <section>
      <Text className="section-kicker">FRONTEND FOUNDATION</Text>
      <Title>统一体验组件</Title>
      <Paragraph type="secondary" className="page-lead">
        这些组件提供一致的状态、风险、证据内容和危险操作交互，供后续事故与 Agent 页面直接复用。
      </Paragraph>
      <Card title="语义状态" className="surface-card">
        <Space wrap size="large">
          <StatusTag status="HEALTHY" />
          <StatusTag status="PENDING" />
          <StatusTag status="FAILED" />
          <RiskTag risk="LOW" />
          <RiskTag risk="MEDIUM" />
          <RiskTag risk="HIGH" />
          <Confidence value={0.87} />
        </Space>
      </Card>
      <Card title="结构化内容查看器" className="surface-card">
        <ContentViewer
          json={{ user: user.username, roles: user.roles, requestId: '由每次请求动态生成' }}
          logs={'2026-09-19T03:00:00Z INFO request completed\n敏感正文默认不展示'}
          trace={'api.request → security.filter → identity.service'}
        />
      </Card>
      <Button danger onClick={() => setDangerOpen(true)}>
        查看危险操作确认
      </Button>
      <DangerousActionDialog
        open={dangerOpen}
        title="确认演示危险操作"
        impact="本对话框只演示二次确认规范，不会调用后端或改变数据。"
        onConfirm={() => setDangerOpen(false)}
        onCancel={() => setDangerOpen(false)}
      />
    </section>
  );
}

type EditState =
  | { kind: 'create' }
  | { kind: 'roles'; user: ManagedUser }
  | { kind: 'password'; user: ManagedUser }
  | null;

function UserManagementPage({ currentUser }: { currentUser: CurrentUser }) {
  const { message } = AntApp.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [queryDraft, setQueryDraft] = useState(searchParams.get('query') ?? '');
  const [editState, setEditState] = useState<EditState>(null);
  const [disableTarget, setDisableTarget] = useState<ManagedUser | null>(null);
  const page = Math.max(0, Number(searchParams.get('page') ?? '0') || 0);
  const size = [10, 20, 50].includes(Number(searchParams.get('size')))
    ? Number(searchParams.get('size'))
    : 10;
  const query = searchParams.get('query') ?? '';
  const sort = searchParams.get('sort') ?? 'username,asc';

  const users = useQuery({
    queryKey: ['users', page, size, query, sort],
    queryFn: () => identityApi.users({ page, size, query, sort }),
    placeholderData: keepPreviousData,
  });
  const mutate = useMutation({
    mutationFn: (input: { action: () => Promise<ManagedUser>; success: string }) => input.action(),
    onSuccess: async (_, input) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditState(null);
      setDisableTarget(null);
      void message.success(input.success);
    },
    onError: (error) => void message.error(error instanceof Error ? error.message : '操作失败'),
  });

  function updateSearch(next: Record<string, string>) {
    const value = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, item]) => value.set(key, item));
    setSearchParams(value, { replace: true });
  }

  const columns: ColumnsType<ManagedUser> = useMemo(
    () => [
      {
        title: '用户',
        key: 'user',
        render: (_, user) => (
          <Space orientation="vertical" size={0}>
            <Text strong>{user.displayName}</Text>
            <Text type="secondary">@{user.username}</Text>
          </Space>
        ),
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        render: (enabled: boolean) => <StatusTag status={enabled ? 'ENABLED' : 'DISABLED'} />,
      },
      {
        title: '角色',
        dataIndex: 'roles',
        render: (items: RoleName[]) => (
          <Space wrap>
            {items.map((role) => (
              <StatusTag key={role} status={role} />
            ))}
          </Space>
        ),
      },
      {
        title: '首次改密',
        dataIndex: 'mustChangePassword',
        render: (required: boolean) => (required ? '待完成' : '已完成'),
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        render: (_, user) => (
          <Space wrap>
            <Button size="small" onClick={() => setEditState({ kind: 'roles', user })}>
              编辑角色
            </Button>
            <Button size="small" onClick={() => setEditState({ kind: 'password', user })}>
              重置密码
            </Button>
            {user.enabled ? (
              <Button
                size="small"
                danger
                disabled={user.id === currentUser.id}
                onClick={() => setDisableTarget(user)}
              >
                禁用
              </Button>
            ) : (
              <Button
                size="small"
                onClick={() =>
                  mutate.mutate({
                    action: () => identityApi.changeStatus(user.id, true),
                    success: '用户已启用。',
                  })
                }
              >
                启用
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [currentUser.id, mutate],
  );

  return (
    <section>
      <div className="page-heading">
        <div>
          <Text className="section-kicker">ADMINISTRATION</Text>
          <Title>用户与角色</Title>
        </div>
        <Button type="primary" onClick={() => setEditState({ kind: 'create' })}>
          新增用户
        </Button>
      </div>
      <Card className="surface-card">
        <form
          className="filter-row"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            updateSearch({ query: queryDraft, page: '0' });
          }}
        >
          <label htmlFor="user-query">搜索用户</label>
          <Input
            id="user-query"
            value={queryDraft}
            allowClear
            placeholder="用户名或显示名称"
            onChange={(event) => setQueryDraft(event.target.value)}
          />
          <label htmlFor="user-sort">排序方式</label>
          <Select
            id="user-sort"
            aria-label="排序方式"
            value={sort}
            options={[
              { value: 'username,asc', label: '用户名升序' },
              { value: 'username,desc', label: '用户名降序' },
              { value: 'createdAt,desc', label: '创建时间降序' },
            ]}
            onChange={(value) => updateSearch({ sort: value, page: '0' })}
          />
          <Button htmlType="submit">查询</Button>
        </form>
      </Card>
      {users.error && <RequestError error={users.error} onRetry={() => void users.refetch()} />}
      {!users.error && (
        <ServerTable
          columns={columns}
          data={users.data?.content ?? []}
          loading={users.isLoading || users.isFetching}
          page={page}
          pageSize={size}
          total={users.data?.totalElements ?? 0}
          emptyTitle="没有符合条件的用户"
          onPageChange={(nextPage, nextSize) =>
            updateSearch({ page: String(nextPage), size: String(nextSize) })
          }
        />
      )}
      <UserEditDialog
        state={editState}
        loading={mutate.isPending}
        onCancel={() => setEditState(null)}
        onSubmit={(values) => {
          if (editState?.kind === 'create') {
            mutate.mutate({
              action: () => identityApi.createUser(values as CreateUserValues),
              success: '用户已创建，并要求首次登录修改密码。',
            });
          } else if (editState?.kind === 'roles') {
            mutate.mutate({
              action: () => identityApi.replaceRoles(editState.user.id, values.roles),
              success: '角色已更新。',
            });
          } else if (editState?.kind === 'password') {
            mutate.mutate({
              action: () =>
                identityApi.resetPassword(editState.user.id, values.temporaryPassword ?? ''),
              success: '临时密码已重置，用户下次登录必须修改密码。',
            });
          }
        }}
      />
      <DangerousActionDialog
        open={disableTarget !== null}
        title="确认禁用用户"
        impact={`禁用后 ${disableTarget?.displayName ?? '该用户'} 的现有会话会立即失效。`}
        confirmText="确认禁用"
        loading={mutate.isPending}
        onCancel={() => setDisableTarget(null)}
        onConfirm={() => {
          if (disableTarget) {
            mutate.mutate({
              action: () => identityApi.changeStatus(disableTarget.id, false),
              success: '用户已禁用，既有令牌立即失效。',
            });
          }
        }}
      />
    </section>
  );
}

type CreateUserValues = {
  username: string;
  displayName: string;
  temporaryPassword: string;
  roles: RoleName[];
};

function UserEditDialog({
  state,
  loading,
  onCancel,
  onSubmit,
}: {
  state: EditState;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (values: CreateUserValues) => void;
}) {
  const [form] = Form.useForm<CreateUserValues>();
  useEffect(() => {
    if (!state) return;
    form.resetFields();
    if (state.kind === 'roles') {
      form.setFieldsValue({ roles: state.user.roles });
    } else if (state.kind === 'create') {
      form.setFieldsValue({ roles: ['VIEWER'] });
    }
  }, [form, state]);
  const title =
    state?.kind === 'create' ? '新增用户' : state?.kind === 'roles' ? '编辑角色' : '重置密码';
  return (
    <Modal
      open={state !== null}
      title={title}
      okText={
        state?.kind === 'create' ? '创建用户' : state?.kind === 'roles' ? '保存角色' : '重置密码'
      }
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => void form.validateFields().then(onSubmit)}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {state?.kind === 'create' && (
          <>
            <Form.Item label="用户名" name="username" rules={[{ required: true }]}>
              <Input maxLength={64} />
            </Form.Item>
            <Form.Item label="显示名称" name="displayName" rules={[{ required: true }]}>
              <Input maxLength={100} />
            </Form.Item>
          </>
        )}
        {(state?.kind === 'create' || state?.kind === 'password') && (
          <Form.Item
            label="临时密码"
            name="temporaryPassword"
            rules={[{ required: true }, { min: 12, message: '至少输入 12 个字符' }]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        )}
        {(state?.kind === 'create' || state?.kind === 'roles') && (
          <Form.Item
            label="角色"
            name="roles"
            rules={[{ required: true, message: '至少选择一个角色' }]}
          >
            <Checkbox.Group options={roles} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

function ForbiddenPage() {
  const navigate = useNavigate();
  return (
    <RouteStatus
      code="403"
      title="无权访问"
      detail="当前角色没有访问此页面的权限。"
      onHome={() => navigate('/')}
    />
  );
}

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <RouteStatus
      code="404"
      title="页面不存在"
      detail="链接可能已失效，请从导航重新进入。"
      onHome={() => navigate('/')}
    />
  );
}

function ServerErrorPage() {
  const navigate = useNavigate();
  return (
    <RouteStatus
      code="500"
      title="页面加载失败"
      detail="请稍后重试；若问题持续，请携带 Request ID 联系管理员。"
      onHome={() => navigate('/')}
    />
  );
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled route error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <RouteStatus
          code="500"
          title="应用发生异常"
          detail={this.state.error.message}
          onHome={() => {
            this.setState({ error: undefined });
            window.history.replaceState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
          }}
        />
      );
    }
    return this.props.children;
  }
}
