/**
 * AuthGuard - Protects routes that require authentication.
 * In dev mode, all routes are accessible without login.
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Dev mode: bypass auth
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default AuthGuard;
