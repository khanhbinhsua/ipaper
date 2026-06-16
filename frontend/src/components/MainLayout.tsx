import { useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, Typography, List, Button, Empty } from 'antd';
import {
  DashboardOutlined, InboxOutlined, SendOutlined, FileTextOutlined,
  TeamOutlined, SearchOutlined, PlusCircleOutlined, FormOutlined,
  CalendarOutlined, BellOutlined, UserOutlined, LogoutOutlined, KeyOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import dayjs from 'dayjs';
import { useAuthStore } from '../store/auth.store';
import { useNotificationStore } from '../store/notification.store';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Thống kê' },
  { key: '/inbox', icon: <InboxOutlined />, label: 'Hồ sơ đến' },
  { key: '/outbox', icon: <SendOutlined />, label: 'Hồ sơ đi' },
  { key: '/draft', icon: <FileTextOutlined />, label: 'Hồ sơ nháp' },
  { key: '/related', icon: <TeamOutlined />, label: 'Hồ sơ liên quan' },
  { key: '/search', icon: <SearchOutlined />, label: 'Tìm hồ sơ' },
  { key: '/create', icon: <PlusCircleOutlined />, label: 'Tạo yêu cầu' },
  { key: '/templates', icon: <FormOutlined />, label: 'Tạo theo mẫu' },
  { key: '/leave', icon: <CalendarOutlined />, label: 'Đăng ký nghỉ' },
];

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { items, unread, init, markRead, markAllRead, disconnect } = useNotificationStore();

  useEffect(() => { init(); }, [init]);

  const handleLogout = () => { disconnect(); logout(); navigate('/login'); };

  const notiDropdown = (
    <div style={{ width: 340, background: '#fff', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
        <b>Thông báo</b>
        {unread > 0 && <Button type="link" size="small" onClick={markAllRead}>Đọc tất cả</Button>}
      </div>
      {items.length ? (
        <List
          style={{ maxHeight: 360, overflowY: 'auto' }}
          dataSource={items.slice(0, 15)}
          renderItem={(n) => (
            <List.Item
              style={{ padding: '8px 12px', cursor: 'pointer', background: n.isRead ? '#fff' : '#e6f4ff' }}
              onClick={() => { markRead(n.id); if (n.documentId) navigate(`/documents/${n.documentId}`); }}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: n.isRead ? 400 : 600, fontSize: 13 }}>{n.message}</span>}
                description={<span style={{ fontSize: 11, color: '#999' }}>{dayjs(n.createdAt).format('DD/MM/YYYY HH:mm')}</span>}
              />
            </List.Item>
          )}
        />
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo" style={{ padding: 24 }} />}
    </div>
  );

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Thông tin người dùng' },
      { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Thoát', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') handleLogout();
      if (key === 'profile') navigate('/profile');
      if (key === 'password') navigate('/change-password');
    },
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={230} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Title level={4} style={{ margin: 0, color: '#1677ff' }}>iPaper</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Luồn văn bản điện tử</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 24, borderBottom: '1px solid #f0f0f0' }}>
          <Dropdown popupRender={() => notiDropdown} placement="bottomRight" trigger={['click']}>
            <Badge count={unread} size="small">
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>
          </Dropdown>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Avatar src={user?.avatar} icon={<UserOutlined />} />
              <span>{user?.fullName || user?.username}</span>
            </div>
          </Dropdown>
        </Header>

        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
