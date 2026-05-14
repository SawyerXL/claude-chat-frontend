export interface User {
  id: number;
  email: string;
  username: string;
  name?: string;
  role: string;
  balance: number;
  concurrency: number;
  status: string;
  allowed_groups?: string[] | null;
  last_active_at?: string;
  created_at?: string;
  updated_at?: string;
  balance_notify_enabled?: boolean;
  total_recharged?: number;
  rpm_limit?: number;
}

const AUTH_TOKEN_KEY = 'claude_auth_token';
const USER_KEY = 'claude_user';

export async function login(email: string, password: string): Promise<{ access_token: string; user: User }> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const result = (await response.json()) as { code: number; data?: { access_token: string; user: User } };
  
  if (result.code !== 0 || !result.data) {
    throw new Error('Login failed');
  }

  const { access_token, user } = result.data;

  // Save to localStorage
  localStorage.setItem(AUTH_TOKEN_KEY, access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  return { access_token, user };
}

export function logout(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getCurrentUser(): User | null {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export interface LoginResponse {
  access_token: string;
  user: User;
}