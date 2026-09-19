export type RoleName = 'VIEWER' | 'OPERATOR' | 'APPROVER' | 'ADMIN';

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  mustChangePassword: boolean;
  roles: RoleName[];
};

export type LoginResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: CurrentUser;
};

export type ManagedUser = CurrentUser & {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserPage = {
  content: ManagedUser[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type UserQuery = {
  page: number;
  size: number;
  query: string;
  sort: string;
};

type ProblemDetails = {
  detail?: string;
  errorCode?: string;
  requestId?: string;
};

type SessionHooks = {
  token: () => string | null;
  onUnauthorized: () => void;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
let sessionHooks: SessionHooks = { token: () => null, onUnauthorized: () => undefined };

export function configureApiSession(hooks: SessionHooks) {
  sessionHooks = hooks;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly requestId?: string;

  constructor(status: number, problem: ProblemDetails, fallbackRequestId?: string) {
    super(problem.detail ?? `Request failed with HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = problem.errorCode ?? 'HTTP_ERROR';
    this.requestId = problem.requestId ?? fallbackRequestId;
  }
}

type RequestOptions = RequestInit & { authenticated?: boolean; retryUnauthorized?: boolean };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated = true, retryUnauthorized = false, ...init } = options;
  const headers = new Headers(init.headers);
  const requestId = crypto.randomUUID();
  headers.set('Accept', 'application/json');
  headers.set('X-Request-ID', requestId);
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = sessionHooks.token();
  if (authenticated && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let problem: ProblemDetails = {};
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = { detail: `Request failed with HTTP ${response.status}` };
    }
    const responseRequestId = response.headers.get('X-Request-ID') ?? requestId;
    if (authenticated && response.status === 401 && !retryUnauthorized) {
      sessionHooks.onUnauthorized();
    }
    throw new ApiError(response.status, problem, responseRequestId);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const identityApi = {
  login(username: string, password: string) {
    return apiRequest<LoginResponse>('/api/v1/auth/login', {
      authenticated: false,
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me() {
    return apiRequest<CurrentUser>('/api/v1/auth/me', { retryUnauthorized: true });
  },
  logout() {
    return apiRequest<void>('/api/v1/auth/logout', { method: 'POST' });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return apiRequest<LoginResponse>('/api/v1/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  users(input: UserQuery) {
    const search = new URLSearchParams({
      page: String(input.page),
      size: String(input.size),
      query: input.query,
      sort: input.sort,
    });
    return apiRequest<UserPage>(`/api/v1/users?${search}`);
  },
  createUser(input: {
    username: string;
    displayName: string;
    temporaryPassword: string;
    roles: RoleName[];
  }) {
    return apiRequest<ManagedUser>('/api/v1/users', {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(input),
    });
  },
  changeStatus(userId: string, enabled: boolean) {
    return apiRequest<ManagedUser>(`/api/v1/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  },
  resetPassword(userId: string, temporaryPassword: string) {
    return apiRequest<ManagedUser>(`/api/v1/users/${userId}/reset-password`, {
      method: 'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify({ temporaryPassword }),
    });
  },
  replaceRoles(userId: string, roles: RoleName[]) {
    return apiRequest<ManagedUser>(`/api/v1/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({ roles }),
    });
  },
};
