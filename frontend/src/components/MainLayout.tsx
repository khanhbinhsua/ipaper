import { Layout, Menu, Avatar, Dropdown, Badge, Typography } from 'antd';
import {
  DashboardOutlined, InboxOutlined, SendOutlined, FileTextOutlined,
  TeamOutlined, SearchOutlined, PlusCircleOutlined, FormOutlined,
  CalendarOutlined, BellOutlined, UserOutlined, LogoutOutlined, KeyOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';

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

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Thông tin người dùng' },
      { key: 'password', icon: <KeyOutlined />, label: 'Đổi mật khẩu' },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Thoát', danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === 'logout') { logout(); navigate('/login'); }
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
          <Badge count={0} size="small">
            <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} onClick={() => navigate('/inbox')} />
          </Badge>
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
