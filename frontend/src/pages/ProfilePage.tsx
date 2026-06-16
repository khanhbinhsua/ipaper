import { Card, Descriptions, Switch, Avatar, message, Space, Divider } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

const roleLabels: Record<string, string> = { admin: 'Quản trị', staff: 'Nhân viên', manager: 'Quản lý' };

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  const mutation = useMutation({
    mutationFn: (data: { notifyWeb?: boolean; notifyEmail?: boolean }) => api.patch('/users/me', data),
    onSuccess: (_res, vars) => { updateUser(vars); message.success('Đã cập nhật'); },
    onError: () => message.error('Cập nhật thất bại'),
  });

  if (!user) return null;

  return (
    <div style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>Thông tin người dùng</h2>
      <Card>
        <Space size="large" align="center" style={{ marginBottom: 16 }}>
          <Avatar size={72} src={user.avatar} icon={<UserOutlined />} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{user.fullName}</div>
            <div style={{ color: '#888' }}>{user.email}</div>
          </div>
        </Space>

        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Tên đăng nhập">{user.username}</Descriptions.Item>
          <Descriptions.Item label="Bộ phận">{user.orgUnit || '—'}</Descriptions.Item>
          <Descriptions.Item label="Vai trò">{roleLabels[user.role] || user.role}</Descriptions.Item>
          <Descriptions.Item label="Loại tài khoản">{user.isDomainUser ? 'Tài khoản domain' : 'Tài khoản nội bộ'}</Descriptions.Item>
        </Descriptions>

        <Divider>Cài đặt thông báo</Divider>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: 320 }}>
            <span>Nhận thông báo trên hệ thống</span>
            <Switch checked={user.notifyWeb} onChange={(v) => mutation.mutate({ notifyWeb: v })} />
          </Space>
          <Space style={{ justifyContent: 'space-between', width: 320 }}>
            <span>Nhận thông báo qua Email</span>
            <Switch checked={user.notifyEmail} onChange={(v) => mutation.mutate({ notifyEmail: v })} />
          </Space>
        </Space>
      </Card>
    </div>
  );
}
