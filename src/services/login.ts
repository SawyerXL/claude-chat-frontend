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
  console.log('[LoginService] Starting login for:', username);
  console.log('[LoginService] URL:', '/api/v1/auth/login');
  
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: username, password }),
    });

    console.log('[LoginService] Response status:', res.status);
    console.log('[LoginService] Response ok:', res.ok);
    
    const data = await res.json();
    console.log('[LoginService] Response data:', JSON.stringify(data).substring(0, 200));

    if (data.code === 0 && data.data?.access_token) {
      const token = data.data.access_token;
      // 保存 token 到 localStorage
      localStorage.setItem('claude_auth_token', token);
      localStorage.setItem('claude_user', JSON.stringify(data.data.user || { username }));

      // 清除旧的 API Key，确保使用当前用户的 key
      localStorage.removeItem('claude_api_key');

      // 获取用户的 API Key 列表，使用第一个可用的 key
      try {
        const keysRes = await fetch('/api/v1/keys?page=1&page_size=10', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const keysData = await keysRes.json();
        console.log('[login] Keys response:', JSON.stringify(keysData, null, 2));

        // API 返回格式: { data: { items: [...] } }
        // 尝试多种可能的响应格式
        let keyList = keysData.data?.items || keysData.data?.list || keysData.data?.keys || [];
        if (!Array.isArray(keyList)) {
          // 如果 data 不是数组，可能是直接的对象
          if (typeof keysData.data === 'object' && keysData.data !== null && Array.isArray(keysData.data.items)) {
            keyList = keysData.data.items;
          }
        }

        console.log('[login] keyList extracted:', keyList);

        if (keysData.code === 0 && keyList.length > 0) {
          // 使用第一个启用状态的 API Key
          const activeKey = keyList.find((k: any) => k.status === 'active') || keyList[0];
          console.log('[login] activeKey:', activeKey);
          if (activeKey && (activeKey.key || activeKey.api_key || activeKey.value)) {
            const apiKey = activeKey.key || activeKey.api_key || activeKey.value;
            localStorage.setItem('claude_api_key', apiKey);
            console.log('[login] API Key set:', apiKey.substring(0, 8) + '...');
          } else {
            console.warn('[login] Key object has no key field:', activeKey);
          }
        } else {
          console.warn('[login] No API keys found, keysData:', keysData);
        }
      } catch (e) {
        console.log('[login] Failed to fetch API keys, key cleared:', e);
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
