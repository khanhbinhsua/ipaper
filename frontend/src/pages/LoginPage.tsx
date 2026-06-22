import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined, BankOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

const { Title } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: { username: string; password: string; tenantSlug: string }) => {
    try {
      await login(values.username, values.password, values.tenantSlug);
      navigate('/');
    } catch {
      message.error('Tên đăng nhập hoặc mật khẩu không đúng');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 380, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={3} style={{ margin: 0, color: '#E4002B' }}>iPaper System</Title>
          <Typography.Text type="secondary">Hệ thống luồng văn bản điện tử</Typography.Text>
        </div>

        <Form layout="vertical" onFinish={onFinish} autoComplete="off" initialValues={{ tenantSlug: 'DKGroup' }}>
          <Form.Item name="tenantSlug" rules={[{ required: true, message: 'Nhập mã tổ chức' }]}>
            <Input prefix={<BankOutlined />} placeholder="Mã tổ chức" size="large" />
          </Form.Item>

          <Form.Item name="username" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
            <Input prefix={<UserOutlined />} placeholder="Tên đăng nhập" size="large" />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" size="large" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
