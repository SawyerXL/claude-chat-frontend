export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  balance: number;
  concurrency: number;
  status: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
}

const AUTH_TOKEN_KEY = 'claude_auth_token';
const USER_KEY = 'claude_user';

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Login failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const data = (await response.json()) as { data: LoginResponse };
  const loginData = data.data;

  // Save to localStorage
  localStorage.setItem(AUTH_TOKEN_KEY, loginData.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(loginData.user));

  return loginData;
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

export async function refreshUserInfo(): Promise<User | null> {
  // Re-login to refresh user info
  const user = getCurrentUser();
  if (!user) return null;

  // For now, just return the cached user
  // In production, you might want a dedicated /api/v1/user endpoint
  return user;
}
