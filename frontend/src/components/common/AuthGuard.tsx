/**
 * AuthGuard - Protects routes that require authentication.
 */
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

export function AuthGuard({ children }: AuthGuardProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const hasCheckedSession = useAuthStore((s) => s.hasCheckedSession);
  const loadUser = useAuthStore((s) => s.loadUser);

  useEffect(() => {
    if (!hasCheckedSession && !isLoading) {
      loadUser();
    }
  }, [hasCheckedSession, isLoading, loadUser]);

  if (isLoading || !hasCheckedSession) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default AuthGuard;
