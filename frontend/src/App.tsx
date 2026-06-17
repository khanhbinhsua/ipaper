import { type ReactNode, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import DashboardPage from './pages/DashboardPage';
import CreateDocumentPage from './pages/CreateDocumentPage';
import DocumentListPage from './pages/DocumentListPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import LeavePage from './pages/LeavePage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import TemplatesPage from './pages/TemplatesPage';
import AdminUsersPage from './pages/AdminUsersPage';
import { useAuthStore } from './store/auth.store';

function PrivateRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={viVN}
        theme={{
          token: { colorPrimary: '#E4002B', colorLink: '#E4002B', borderRadius: 4 },
          components: {
            Menu: { itemSelectedBg: '#fff1f0', itemSelectedColor: '#E4002B' },
            Layout: { siderBg: '#fff' },
          },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/inbox" element={<DocumentListPage box="inbox" />} />
              <Route path="/outbox" element={<DocumentListPage box="outbox" />} />
              <Route path="/draft" element={<DocumentListPage box="draft" />} />
              <Route path="/related" element={<DocumentListPage box="related" />} />
              <Route path="/search" element={<DocumentListPage box="all" />} />
              <Route path="/create" element={<CreateDocumentPage />} />
              <Route path="/documents/:id" element={<DocumentDetailPage />} />
              <Route path="/leave" element={<LeavePage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
