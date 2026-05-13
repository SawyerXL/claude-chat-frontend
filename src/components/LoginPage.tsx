import { useState } from 'react';
import { message } from 'antd';
import { login } from '../services/auth';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('admin@sub2api.local');
  const [password, setPassword] = useState('Mdgk@2024!');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      message.success('登录成功');
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">C</div>
          <h1 className="login-title">Claude</h1>
          <p className="login-subtitle">登录以继续对话</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label>邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sub2api.local"
              required
            />
          </div>

          <div className="login-field">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1a1a18;
        }

        .login-container {
          width: 100%;
          max-width: 320px;
          padding: 32px 24px;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 28px;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #d97757, #a84d2e);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 14px;
          font-size: 24px;
          font-weight: 600;
          color: #fff;
        }

        .login-title {
          font-size: 22px;
          font-weight: 600;
          color: #f5f4ee;
          margin: 0 0 6px;
        }

        .login-subtitle {
          font-size: 13px;
          color: #8a8780;
          margin: 0;
        }

        .login-form {
          background: #2d2c2a;
          border: 1px solid #3a3836;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .login-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .login-field label {
          font-size: 13px;
          color: #b8b6b0;
        }

        .login-field input {
          background: #30302e;
          border: 1px solid #3a3836;
          color: #f5f4ee;
          border-radius: 8px;
          height: 42px;
          padding: 0 12px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
        }

        .login-field input:focus {
          border-color: #d97757;
        }

        .login-field input::placeholder {
          color: #8a8780;
        }

        .login-btn {
          height: 42px;
          background: #d97757;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
        }

        .login-btn:hover:not(:disabled) {
          background: #c96a4a;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}