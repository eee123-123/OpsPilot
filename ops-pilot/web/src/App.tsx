import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, CurrentUser, identityApi, ManagedUser, RoleName } from './api';

type Session = { token: string; user: CurrentUser };
type Notice = { kind: 'error' | 'success'; message: string; requestId?: string };
const sessionKey = 'ops-pilot.access-token';
const roles: RoleName[] = ['VIEWER', 'OPERATOR', 'APPROVER', 'ADMIN'];

function currentPath() {
  return window.location.pathname;
}

function navigate(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function errorNotice(error: unknown): Notice {
  if (error instanceof ApiError) {
    return { kind: 'error', message: error.message, requestId: error.requestId };
  }
  return { kind: 'error', message: error instanceof Error ? error.message : '未知错误' };
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(() => sessionStorage.getItem(sessionKey) !== null);
  const [expired, setExpired] = useState(false);
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onNavigation = () => setPath(currentPath());
    window.addEventListener('popstate', onNavigation);
    return () => window.removeEventListener('popstate', onNavigation);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(sessionKey);
    if (!token) {
      return;
    }
    const controller = new AbortController();
    identityApi
      .me(token)
      .then((user) => {
        if (!controller.signal.aborted) {
          setSession({ token, user });
        }
      })
      .catch(() => {
        sessionStorage.removeItem(sessionKey);
        if (!controller.signal.aborted) {
          setExpired(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setRestoring(false);
        }
      });
    return () => controller.abort();
  }, []);

  const saveSession = useCallback((next: Session) => {
    sessionStorage.setItem(sessionKey, next.token);
    setSession(next);
    setExpired(false);
  }, []);

  const expireSession = useCallback(() => {
    sessionStorage.removeItem(sessionKey);
    setSession(null);
    setExpired(true);
    navigate('/login');
  }, []);

  if (restoring) {
    return <FullPageStatus title="正在恢复会话" detail="正在验证本地访问令牌。" />;
  }
  if (!session) {
    return <LoginPage expired={expired} onLogin={saveSession} />;
  }
  if (session.user.mustChangePassword) {
    return <ChangePasswordPage session={session} onChanged={saveSession} />;
  }
  return (
    <AuthenticatedApp
      session={session}
      path={path}
      onExpired={expireSession}
      onLogout={() => {
        sessionStorage.removeItem(sessionKey);
        setSession(null);
        navigate('/login');
      }}
    />
  );
}

function LoginPage({
  expired,
  onLogin,
}: {
  expired: boolean;
  onLogin: (session: Session) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await identityApi.login(username, password);
      onLogin({ token: response.accessToken, user: response.user });
      navigate(response.user.mustChangePassword ? '/change-password' : '/');
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="brand-panel">
        <p className="eyebrow">INTELLIGENT INCIDENT OPERATIONS</p>
        <h1>OpsPilot</h1>
        <p>可审计、可恢复、证据优先的智能故障诊断与应急处置平台。</p>
      </section>
      <section className="auth-card" aria-labelledby="login-title">
        <p className="section-kicker">SECURE ACCESS</p>
        <h2 id="login-title">登录控制台</h2>
        {expired && <NoticeBox notice={{ kind: 'error', message: '会话已过期，请重新登录。' }} />}
        {notice && <NoticeBox notice={notice} />}
        <form onSubmit={submit}>
          <label htmlFor="username">用户名</label>
          <input
            id="username"
            autoComplete="username"
            required
            maxLength={64}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="password">密码</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
      </section>
    </main>
  );
}

function ChangePasswordPage({
  session,
  onChanged,
}: {
  session: Session;
  onChanged: (next: Session) => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmation) {
      setNotice({ kind: 'error', message: '两次输入的新密码不一致。' });
      return;
    }
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await identityApi.changePassword(
        session.token,
        currentPassword,
        newPassword,
      );
      onChanged({ token: response.accessToken, user: response.user });
      navigate('/');
    } catch (error) {
      setNotice(errorNotice(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell single">
      <section className="auth-card" aria-labelledby="change-password-title">
        <p className="section-kicker">FIRST LOGIN</p>
        <h2 id="change-password-title">首次登录，请修改密码</h2>
        <p className="muted">新密码需为 12–128 位，并包含大小写字母、数字和符号。</p>
        {notice && <NoticeBox notice={notice} />}
        <form onSubmit={submit}>
          <label htmlFor="current-password">当前密码</label>
          <input
            id="current-password"
            type="password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <label htmlFor="new-password">新密码</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={12}
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <label htmlFor="confirm-password">确认新密码</label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
          />
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? '保存中…' : '修改密码并继续'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AuthenticatedApp({
  session,
  path,
  onExpired,
  onLogout,
}: {
  session: Session;
  path: string;
  onExpired: () => void;
  onLogout: () => void;
}) {
  const isAdmin = session.user.roles.includes('ADMIN');
  async function logout() {
    try {
      await identityApi.logout(session.token);
    } catch {
      // Local logout still removes the browser token when the server is unavailable.
    } finally {
      onLogout();
    }
  }

  let content = <Dashboard user={session.user} />;
  if (path === '/users') {
    content = isAdmin ? (
      <UserManagementPage session={session} onExpired={onExpired} />
    ) : (
      <FullPageStatus title="无权访问" detail="用户管理仅对 ADMIN 角色开放。" />
    );
  } else if (path !== '/' && path !== '/login') {
    content = <FullPageStatus title="页面不存在" detail="请从左侧导航选择可用页面。" />;
  }

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <button className="brand-button" type="button" onClick={() => navigate('/')}>
          OpsPilot
        </button>
        <nav aria-label="主导航">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-current={path === '/' ? 'page' : undefined}
          >
            系统概览
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/users')}
              aria-current={path === '/users' ? 'page' : undefined}
            >
              用户管理
            </button>
          )}
        </nav>
        <div className="user-summary">
          <strong>{session.user.displayName}</strong>
          <span>{session.user.roles.join(' · ')}</span>
          <button type="button" onClick={() => void logout()}>
            退出登录
          </button>
        </div>
      </aside>
      <main className="workspace">{content}</main>
    </div>
  );
}

function Dashboard({ user }: { user: CurrentUser }) {
  return (
    <section>
      <p className="section-kicker">IDENTITY FOUNDATION</p>
      <h1 className="page-title">欢迎，{user.displayName}</h1>
      <p className="lead">
        身份验证和角色权限已生效。后续事故、审批与 Agent 功能将在此工作区逐步接入。
      </p>
      <div className="role-grid">
        {roles.map((role) => (
          <article
            className={user.roles.includes(role) ? 'role-card active' : 'role-card'}
            key={role}
          >
            <span>{role}</span>
            <strong>{user.roles.includes(role) ? '已授予' : '未授予'}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function UserManagementPage({ session, onExpired }: { session: Session; onExpired: () => void }) {
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(
    async (clearNotice = true) => {
      setUsers(null);
      if (clearNotice) {
        setNotice(null);
      }
      try {
        const page = await identityApi.users(session.token, 0, query);
        setUsers(page.content);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          onExpired();
          return;
        }
        setNotice(errorNotice(error));
        setUsers([]);
      }
    },
    [onExpired, query, session.token],
  );

  useEffect(() => {
    let active = true;
    identityApi
      .users(session.token, 0, query)
      .then((page) => {
        if (active) {
          setUsers(page.content);
        }
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          onExpired();
          return;
        }
        setNotice(errorNotice(error));
        setUsers([]);
      });
    return () => {
      active = false;
    };
  }, [onExpired, query, session.token]);

  async function mutate(action: () => Promise<ManagedUser>, message: string) {
    setNotice(null);
    try {
      await action();
      await load(false);
      setNotice({ kind: 'success', message });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onExpired();
        return;
      }
      setNotice(errorNotice(error));
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <p className="section-kicker">ADMINISTRATION</p>
          <h1 className="page-title">用户与角色</h1>
        </div>
        <button className="primary" type="button" onClick={() => setShowCreate((value) => !value)}>
          {showCreate ? '取消新增' : '新增用户'}
        </button>
      </header>
      {notice && <NoticeBox notice={notice} />}
      {showCreate && (
        <CreateUserForm
          token={session.token}
          onCreated={async () => {
            setShowCreate(false);
            await load(false);
            setNotice({ kind: 'success', message: '用户已创建，并要求首次登录修改密码。' });
          }}
          onError={setNotice}
        />
      )}
      <form
        className="search-row"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label htmlFor="user-query">搜索用户</label>
        <input
          id="user-query"
          placeholder="用户名或显示名称"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">查询</button>
      </form>
      {users === null && <div className="panel muted">正在加载用户…</div>}
      {users?.length === 0 && <div className="panel muted">没有符合条件的用户。</div>}
      {users && users.length > 0 && (
        <div className="user-list">
          {users.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              currentUserId={session.user.id}
              onStatus={(enabled) =>
                mutate(
                  () => identityApi.changeStatus(session.token, user.id, enabled),
                  enabled ? '用户已启用。' : '用户已禁用，既有令牌立即失效。',
                )
              }
              onReset={(password) =>
                mutate(
                  () => identityApi.resetPassword(session.token, user.id, password),
                  '临时密码已重置，用户下次登录必须修改密码。',
                )
              }
              onRoles={(nextRoles) =>
                mutate(
                  () => identityApi.replaceRoles(session.token, user.id, nextRoles),
                  '角色已更新。',
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CreateUserForm({
  token,
  onCreated,
  onError,
}: {
  token: string;
  onCreated: () => Promise<void>;
  onError: (notice: Notice) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>(['VIEWER']);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await identityApi.createUser(token, {
        username,
        displayName,
        temporaryPassword,
        roles: selectedRoles,
      });
      await onCreated();
    } catch (error) {
      onError(errorNotice(error));
    }
  }

  return (
    <form className="panel create-form" onSubmit={submit}>
      <label htmlFor="new-username">用户名</label>
      <input
        id="new-username"
        required
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <label htmlFor="display-name">显示名称</label>
      <input
        id="display-name"
        required
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <label htmlFor="temporary-password">临时密码</label>
      <input
        id="temporary-password"
        type="password"
        required
        minLength={12}
        value={temporaryPassword}
        onChange={(event) => setTemporaryPassword(event.target.value)}
      />
      <RolePicker value={selectedRoles} onChange={setSelectedRoles} prefix="create" />
      <button className="primary" type="submit">
        创建用户
      </button>
    </form>
  );
}

function UserCard({
  user,
  currentUserId,
  onStatus,
  onReset,
  onRoles,
}: {
  user: ManagedUser;
  currentUserId: string;
  onStatus: (enabled: boolean) => Promise<void>;
  onReset: (password: string) => Promise<void>;
  onRoles: (roles: RoleName[]) => Promise<void>;
}) {
  const [selectedRoles, setSelectedRoles] = useState<RoleName[]>(user.roles);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [confirmDisable, setConfirmDisable] = useState(false);
  const roleChanged = useMemo(
    () => selectedRoles.slice().sort().join() !== user.roles.slice().sort().join(),
    [selectedRoles, user.roles],
  );

  return (
    <article className="user-card">
      <header>
        <div>
          <h2>{user.displayName}</h2>
          <p>
            @{user.username} · {user.enabled ? '已启用' : '已禁用'}
          </p>
        </div>
        {user.mustChangePassword && <span className="pill warning">待修改密码</span>}
      </header>
      <RolePicker value={selectedRoles} onChange={setSelectedRoles} prefix={user.id} />
      <div className="actions">
        <button
          type="button"
          disabled={!roleChanged || selectedRoles.length === 0}
          onClick={() => void onRoles(selectedRoles)}
        >
          保存角色
        </button>
        {user.enabled ? (
          <button
            className="danger"
            type="button"
            disabled={user.id === currentUserId}
            onClick={() => setConfirmDisable(true)}
          >
            禁用
          </button>
        ) : (
          <button type="button" onClick={() => void onStatus(true)}>
            启用
          </button>
        )}
      </div>
      {confirmDisable && (
        <div className="confirm-box" role="alertdialog" aria-label="确认禁用用户">
          <p>禁用后该用户的现有会话会立即失效。确认继续？</p>
          <button className="danger" type="button" onClick={() => void onStatus(false)}>
            确认禁用
          </button>
          <button type="button" onClick={() => setConfirmDisable(false)}>
            取消
          </button>
        </div>
      )}
      <div className="reset-row">
        <label htmlFor={`reset-${user.id}`}>重置临时密码</label>
        <input
          id={`reset-${user.id}`}
          type="password"
          minLength={12}
          value={temporaryPassword}
          onChange={(event) => setTemporaryPassword(event.target.value)}
        />
        <button
          type="button"
          disabled={temporaryPassword.length < 12}
          onClick={() => void onReset(temporaryPassword)}
        >
          重置密码
        </button>
      </div>
    </article>
  );
}

function RolePicker({
  value,
  onChange,
  prefix,
}: {
  value: RoleName[];
  onChange: (roles: RoleName[]) => void;
  prefix: string;
}) {
  return (
    <fieldset className="roles">
      <legend>角色</legend>
      {roles.map((role) => (
        <label key={role} htmlFor={`${prefix}-${role}`}>
          <input
            id={`${prefix}-${role}`}
            type="checkbox"
            checked={value.includes(role)}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? [...value, role]
                  : value.filter((candidate) => candidate !== role),
              )
            }
          />
          {role}
        </label>
      ))}
    </fieldset>
  );
}

function NoticeBox({ notice }: { notice: Notice }) {
  return (
    <div className={`notice ${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span>{notice.message}</span>
      {notice.requestId && <small>Request ID: {notice.requestId}</small>}
    </div>
  );
}

function FullPageStatus({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="status-page">
      <p className="section-kicker">OPS PILOT</p>
      <h1 className="page-title">{title}</h1>
      <p className="lead">{detail}</p>
      <button type="button" onClick={() => navigate('/')}>
        返回首页
      </button>
    </section>
  );
}
