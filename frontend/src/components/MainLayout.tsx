import { useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, List, Button, Empty } from 'antd';
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
  { key: '/templates', icon: <FormOutlined />, label: 'Tạo yêu cầu theo mẫu' },
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
      {/* Viền đỏ thương hiệu trên cùng */}
      <div style={{ height: 3, background: '#E4002B' }} />

      <Layout>
        <Sider theme="light" width={235} style={{ borderRight: '1px solid #f0f0f0' }}>
          <div style={{ padding: '16px', borderBottom: '3px solid #E4002B', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: '#E4002B', letterSpacing: -1 }}>iPaper</span>
            <span style={{ color: '#F9A01B', fontSize: 18 }}>✦</span>
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
          <Header style={{ background: '#fff', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#333' }}>iPaper System</span>
              <span style={{ fontSize: 12, color: '#888' }}>Luồng văn bản điện tử</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <Dropdown popupRender={() => notiDropdown} placement="bottomRight" trigger={['click']}>
                <Badge count={unread} size="small" color="#E4002B">
                  <BellOutlined style={{ fontSize: 20, cursor: 'pointer', color: '#E4002B' }} />
                </Badge>
              </Dropdown>

              <Dropdown menu={userMenu} placement="bottomRight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <Avatar src={user?.avatar} icon={<UserOutlined />} style={{ background: '#E4002B' }} />
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: 11, color: '#999' }}>Chào mừng</div>
                    <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{user?.fullName || user?.username}</div>
                  </div>
                </div>
              </Dropdown>

              <span style={{ fontSize: 13 }}>🇻🇳 Vietnam</span>
            </div>
          </Header>

          <Content style={{ margin: 16, padding: 24, background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0' }}>
            <Outlet />
          </Content>

          <div style={{ textAlign: 'center', padding: 10, background: '#E4002B', color: '#fff', fontSize: 12 }}>
            © Copyright {new Date().getFullYear()} iPaper System
          </div>
        </Layout>
      </Layout>
    </Layout>
  );
}
