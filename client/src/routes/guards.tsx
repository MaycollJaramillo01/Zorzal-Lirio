import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isManager } from '@shared/lib/permissions';
import { Spinner } from '../components/ui';
import { useSession } from '../services/queries';

export function ProtectedRoute() {
  const location = useLocation();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Cargando sesion" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Con `must_change_password` el usuario solo puede llegar a su perfil.
  if (session.mustChangePassword && location.pathname !== '/profile') {
    return <Navigate to="/profile" replace />;
  }

  return <Outlet />;
}

export function ManagerRoute({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  if (!session) return null;
  if (!isManager(session.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
