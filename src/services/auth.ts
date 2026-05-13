export interface User {
  id: number;
  email: string;
  username: string;
  name?: string;
  role: string;
  balance: number;
  concurrency: number;
  status: string;
}

const AUTH_TOKEN_KEY = 'claude_auth_token';
const USER_KEY = 'claude_user';

export async function login(email: string, password: string): Promise<{ access_token: string; user: User }> {
  const response = await fetch('/v1/auth/login', {
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

  const data = (await response.json()) as { token?: string; access_token?: string; user?: User };
  
  const token = data.token || data.access_token;
  const user = data.user || { id: 0, email, username: email.split('@')[0], role: 'user', balance: 0, concurrency: 1, status: 'active' };

  if (!token) {
    throw new Error('No token in response');
  }

  // Save to localStorage
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  return { access_token: token, user };
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