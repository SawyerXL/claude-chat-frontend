import { useState } from 'react';
import { Modal, Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { login } from '../services/login';

interface LoginDialogProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (username: string) => void;
}

export default function LoginDialog({ open, onCancel, onSuccess }: LoginDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  const handleSubmit = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);

    try {
      const result = await login(values.username, values.password);

      if (result.ok && result.username) {
        message.success('登录成功');
        form.resetFields();
        onSuccess(result.username);
      } else {
        setError(result.error || '登录失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setError(null);
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      footer={null}
      title="登录"
      centered
      width={400}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        autoComplete="off"
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="请输入用户名（邮箱）"
            autoComplete="off"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="密码"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="请输入密码"
            autoComplete="off"
          />
        </Form.Item>

        {error && (
          <div style={{ color: '#ff4d4f', marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        <Form.Item style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" htmlType="submit" loading={loading}>
              登录
            </Button>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}
