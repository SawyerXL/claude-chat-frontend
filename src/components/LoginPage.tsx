import { useState } from 'react';
import { Form, Input, Button, message as antMessage } from 'antd';
import { login } from '../services/auth';
import { initTheme } from '../services/theme';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  useState(() => {
    initTheme();
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      antMessage.success('登录成功');
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '登录失败';
      antMessage.error(msg);
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

        <Form
          layout="vertical"
          onFinish={handleSubmit}
          className="login-form"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱' },
            ]}
          >
            <Input placeholder="邮箱" size="large" />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" size="large" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              登录
            </Button>
          </Form.Item>
        </Form>
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
          max-width: 360px;
          padding: 32px;
        }

        .login-logo {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo-icon {
          width: 56px;
          height: 56px;
          background: linear-gradient(135deg, #d97757, #a84d2e);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          font-size: 28px;
          font-weight: 600;
          color: #fff;
        }

        .login-title {
          font-size: 24px;
          font-weight: 600;
          color: #f5f4ee;
          margin: 0 0 8px;
        }

        .login-subtitle {
          font-size: 14px;
          color: #8a8780;
          margin: 0;
        }

        .login-form {
          background: #2d2c2a;
          border: 1px solid #3a3836;
          border-radius: 12px;
          padding: 24px;
        }

        .login-form .ant-input,
        .login-form .ant-input-affix-wrapper {
          background: #30302e !important;
          border-color: #3a3836 !important;
          color: #f5f4ee !important;
          border-radius: 8px;
          height: 44px;
        }

        .login-form .ant-input::placeholder {
          color: #8a8780;
        }

        .login-form .ant-input:focus,
        .login-form .ant-input-affix-wrapper:focus,
        .login-form .ant-input-affix-wrapper-focused {
          border-color: #d97757 !important;
          box-shadow: 0 0 0 2px rgba(217, 119, 87, 0.2) !important;
        }

        .login-form .ant-btn-primary {
          background: #d97757;
          border: none;
          height: 44px;
          font-size: 15px;
          font-weight: 500;
          border-radius: 8px;
        }

        .login-form .ant-btn-primary:hover {
          background: #c96a4a;
        }
      `}</style>
    </div>
  );
}