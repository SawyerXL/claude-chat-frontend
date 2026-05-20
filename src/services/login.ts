/**
 * 登录服务
 * 使用 sub2api 后端进行身份验证
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
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: username, password }),
    });

    const data = await res.json();

    if (data.code === 0 && data.data?.access_token) {
      const token = data.data.access_token;
      // 保存 token 到 localStorage
      localStorage.setItem('claude_auth_token', token);
      localStorage.setItem('claude_user', JSON.stringify(data.data.user || { username }));

      // 获取用户的 API Key 列表，使用第一个可用的 key
      try {
        const keysRes = await fetch('/api/v1/keys?page=1&page_size=10', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const keysData = await keysRes.json();
        if (keysData.code === 0 && keysData.data?.list?.length > 0) {
          // 使用第一个启用状态的 API Key
          const activeKey = keysData.data.list.find((k: any) => k.status === 'active') || keysData.data.list[0];
          localStorage.setItem('claude_api_key', activeKey.key);
        }
      } catch (e) {
        console.log('Failed to fetch API keys:', e);
      }

      return { ok: true, username: data.data.user?.email || username };
    }

    return { ok: false, error: data.message || '登录失败' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : '网络错误',
    };
  }
}

export async function logout(): Promise<LogoutResponse> {
  try {
    const token = localStorage.getItem('claude_auth_token');

    if (token) {
      await fetch('/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    }

    // 清除本地状态
    localStorage.removeItem('claude_auth_token');
    localStorage.removeItem('claude_api_key');
    localStorage.removeItem('claude_user');

    return { ok: true };
  } catch {
    // 网络失败也清除本地状态
    localStorage.removeItem('claude_auth_token');
    localStorage.removeItem('claude_api_key');
    localStorage.removeItem('claude_user');
    return { ok: true };
  }
}

export async function getAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const token = localStorage.getItem('claude_auth_token');
    if (!token) {
      return { loggedIn: false, username: '' };
    }

    const res = await fetch('/api/v1/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (data.code === 0 && data.data) {
      const user = data.data;
      return { loggedIn: true, username: user.email || user.username || '' };
    }

    // token 无效，清除
    localStorage.removeItem('claude_auth_token');
    localStorage.removeItem('claude_user');
    return { loggedIn: false, username: '' };
  } catch {
    return { loggedIn: false, username: '' };
  }
}
