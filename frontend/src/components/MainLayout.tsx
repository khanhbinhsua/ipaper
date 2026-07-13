import { useEffect, useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Badge, List, Button, Empty, Drawer, Grid } from 'antd';
import {
  DashboardOutlined, InboxOutlined, SendOutlined, FileTextOutlined,
  TeamOutlined, SearchOutlined, PlusCircleOutlined, FormOutlined,
  BellOutlined, UserOutlined, LogoutOutlined, KeyOutlined,
  SettingOutlined, MenuOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { vnTime } from '../lib/datetime';
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
];

// Mục chỉ dành cho admin
const adminMenuItem = { key: '/admin/users', icon: <SettingOutlined />, label: 'Quản trị người dùng' };

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { items, unread, init, markRead, markAllRead, disconnect } = useNotificationStore();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md; // < 768px
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { init(); }, [init]);

  const handleLogout = () => { disconnect(); logout(); navigate('/login'); };

  const go = (key: string) => { navigate(key); setDrawerOpen(false); };

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={user?.role === 'admin' ? [...menuItems, adminMenuItem] : menuItems}
      onClick={({ key }) => go(key)}
      style={{ borderRight: 0 }}
    />
  );

  const logo = (
    <div style={{ padding: '16px', borderBottom: '3px solid #E4002B', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color: '#E4002B', letterSpacing: -1 }}>iPaper</span>
      <span style={{ color: '#F9A01B', fontSize: 18 }}>✦</span>
    </div>
  );

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
                description={<span style={{ fontSize: 11, color: '#999' }}>{vnTime(n.createdAt, 'DD/MM/YYYY HH:mm')}</span>}
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
        {/* Desktop: sidebar cố định | Mobile: drawer trượt */}
        {!isMobile && (
          <Sider theme="light" width={235} style={{ borderRight: '1px solid #f0f0f0' }}>
            {logo}
            {menu}
          </Sider>
        )}
        {isMobile && (
          <Drawer
            placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
            width={250} styles={{ body: { padding: 0 }, header: { display: 'none' } }}
          >
            {logo}
            {menu}
          </Drawer>
        )}

        <Layout>
          <Header style={{ background: '#fff', padding: isMobile ? '0 12px' : '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {isMobile && (
                <Button type="text" icon={<MenuOutlined style={{ fontSize: 20 }} />} onClick={() => setDrawerOpen(true)} />
              )}
              <span style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: '#333' }}>iPaper System</span>
              {!isMobile && <span style={{ fontSize: 12, color: '#888' }}>Luồng văn bản điện tử</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 14 : 24 }}>
              <Dropdown popupRender={() => notiDropdown} placement="bottomRight" trigger={['click']}>
                <Badge count={unread} size="small" color="#E4002B">
                  <BellOutlined style={{ fontSize: 20, cursor: 'pointer', color: '#E4002B' }} />
                </Badge>
              </Dropdown>

              <Dropdown menu={userMenu} placement="bottomRight">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <Avatar src={user?.avatar} icon={<UserOutlined />} style={{ background: '#E4002B' }} />
                  {!isMobile && (
                    <div style={{ lineHeight: 1.2 }}>
                      <div style={{ fontSize: 11, color: '#999' }}>Chào mừng</div>
                      <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase' }}>{user?.fullName || user?.username}</div>
                    </div>
                  )}
                </div>
              </Dropdown>

              {!isMobile && <span style={{ fontSize: 13 }}>🇻🇳 Vietnam</span>}
            </div>
          </Header>

          <Content style={{ margin: isMobile ? 8 : 16, padding: isMobile ? 12 : 24, background: '#fff', borderRadius: 4, border: '1px solid #f0f0f0' }}>
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
