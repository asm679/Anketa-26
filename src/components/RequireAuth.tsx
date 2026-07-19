import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: ('admin' | 'viewer')[];
}) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }
  if (roles && role && !roles.includes(role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <>{children}</>;
}
