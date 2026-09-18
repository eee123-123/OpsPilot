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

type ProblemDetails = {
  detail?: string;
  errorCode?: string;
  requestId?: string;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly requestId?: string;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? `Request failed with HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = problem.errorCode ?? 'HTTP_ERROR';
    this.requestId = problem.requestId;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
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
    throw new ApiError(response.status, problem);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const identityApi = {
  login(username: string, password: string) {
    return request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  me(token: string) {
    return request<CurrentUser>('/api/v1/auth/me', {}, token);
  },
  logout(token: string) {
    return request<void>('/api/v1/auth/logout', { method: 'POST' }, token);
  },
  changePassword(token: string, currentPassword: string, newPassword: string) {
    return request<LoginResponse>(
      '/api/v1/auth/change-password',
      { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) },
      token,
    );
  },
  users(token: string, page = 0, query = '') {
    const search = new URLSearchParams({
      page: String(page),
      size: '20',
      query,
      sort: 'username,asc',
    });
    return request<UserPage>(`/api/v1/users?${search}`, {}, token);
  },
  createUser(
    token: string,
    input: { username: string; displayName: string; temporaryPassword: string; roles: RoleName[] },
  ) {
    return request<ManagedUser>(
      '/api/v1/users',
      {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(input),
      },
      token,
    );
  },
  changeStatus(token: string, userId: string, enabled: boolean) {
    return request<ManagedUser>(
      `/api/v1/users/${userId}/status`,
      { method: 'PATCH', body: JSON.stringify({ enabled }) },
      token,
    );
  },
  resetPassword(token: string, userId: string, temporaryPassword: string) {
    return request<ManagedUser>(
      `/api/v1/users/${userId}/reset-password`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ temporaryPassword }),
      },
      token,
    );
  },
  replaceRoles(token: string, userId: string, roles: RoleName[]) {
    return request<ManagedUser>(
      `/api/v1/users/${userId}/roles`,
      { method: 'PUT', body: JSON.stringify({ roles }) },
      token,
    );
  },
};
