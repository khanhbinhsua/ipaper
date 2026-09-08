import { Card, Descriptions, Switch, Avatar, message, Space, Divider, Button, Alert } from 'antd';
import { UserOutlined, BellOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';

// PWA + iOS: kiểm tra có phải PWA cài Home Screen không (Push chỉ hoạt động khi PWA)
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone === true;

const isIOS = /iPad|iPhone|iPod/.test(window.navigator.userAgent);

const roleLabels: Record<string, string> = { admin: 'Quản trị', staff: 'Nhân viên', manager: 'Quản lý' };

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();

  const mutation = useMutation({
    mutationFn: (data: { notifyWeb?: boolean; notifyEmail?: boolean }) => api.patch('/users/me', data),
    onSuccess: (_res, vars) => { updateUser(vars); message.success('Đã cập nhật'); },
    onError: () => message.error('Cập nhật thất bại'),
  });

  const testPush = useMutation({
    mutationFn: () => api.post('/notifications/test-push'),
    onSuccess: () => message.success('Đã gửi. Khóa màn hình để kiểm tra thông báo đẩy.'),
    onError: (e: any) => message.error(e.response?.data?.message || 'Không gửi được'),
  });

  const standalone = isStandalone();
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';

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

        <Divider>Thông báo đẩy (Push)</Divider>

        {/* Chuẩn đoán trực tiếp: cho user biết push có sẵn sàng không */}
        {isIOS && !standalone && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            message="Chưa cài iPaper vào Màn hình chính"
            description={<>iPhone chỉ nhận thông báo đẩy khi mở iPaper từ <b>icon Home Screen</b>, không phải Safari. Vào Safari → nút <b>Chia sẻ</b> ⬆ → <b>Thêm vào Màn hình chính</b>, rồi mở lại app từ đó.</>}
          />
        )}
        {permission === 'default' && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }}
            message="Chưa cho phép thông báo"
            description="Bấm 'Gửi thử thông báo' bên dưới — trình duyệt sẽ hỏi cho phép, bấm Cho phép."
          />
        )}
        {permission === 'denied' && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }}
            message="Đã tắt thông báo cho iPaper"
            description="Vào Cài đặt điện thoại → Thông báo → iPaper → bật lại 'Cho phép Thông báo'."
          />
        )}
        {permission === 'granted' && standalone && (
          <Alert type="success" showIcon style={{ marginBottom: 12 }}
            message="Sẵn sàng nhận thông báo"
            description="Bấm 'Gửi thử thông báo', khóa màn hình → phải thấy thông báo trong 3-5 giây."
          />
        )}

        <Button type="primary" icon={<BellOutlined />} loading={testPush.isPending}
          onClick={() => testPush.mutate()}>
          Gửi thử thông báo cho tôi
        </Button>
      </Card>
    </div>
  );
}
