import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui';
import { AppLayout } from './layouts/AppLayout';
import { ManagerRoute, ProtectedRoute } from './routes/guards';
import { DashboardPage } from './pages/DashboardPage';
import { BalancePage } from './pages/BalancePage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReportsPage } from './pages/ReportsPage';
import { SlaPage } from './pages/SlaPage';
import { TeamPage } from './pages/TeamPage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                <Route
                  path="/team"
                  element={
                    <ManagerRoute>
                      <TeamPage />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/sla"
                  element={
                    <ManagerRoute>
                      <SlaPage />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/balance"
                  element={
                    <ManagerRoute>
                      <BalancePage />
                    </ManagerRoute>
                  }
                />
                <Route
                  path="/reports"
                  element={
                    <ManagerRoute>
                      <ReportsPage />
                    </ManagerRoute>
                  }
                />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
