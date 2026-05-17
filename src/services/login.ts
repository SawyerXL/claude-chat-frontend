/**
 * 登录服务
 * 调用本地后端 /api/login 接口，获取 API Key 并写入 config.json
 */

export interface LoginResponse {
  ok: boolean;
  username?: string;
  error?: string;
}

export interface AuthStatusResponse {
  loggedIn: boolean;
  username: string;
}

export interface LogoutResponse {
  ok: boolean;
  error?: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    return data as LoginResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '网络错误',
    };
  }
}

export async function logout(): Promise<LogoutResponse> {
  try {
    const res = await fetch('/api/logout', {
      method: 'POST',
    });

    const data = await res.json();
    return data as LogoutResponse;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '网络错误',
    };
  }
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const res = await fetch('/api/auth-status');
    const data = await res.json();
    return data as AuthStatusResponse;
  } catch {
    // 网络失败时返回未登录状态
    return { loggedIn: false, username: '' };
  }
}
