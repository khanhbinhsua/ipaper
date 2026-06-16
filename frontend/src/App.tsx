import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import DashboardPage from './pages/DashboardPage';
import CreateDocumentPage from './pages/CreateDocumentPage';
import DocumentListPage from './pages/DocumentListPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import LeavePage from './pages/LeavePage';
import { useAuthStore } from './store/auth.store';

const queryClient = new QueryClient();

function PrivateRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#1677ff' } }}>
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
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
