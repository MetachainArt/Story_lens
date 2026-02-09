/**
 * @TASK P1-S0-T1 - AuthGuard Component
 * @SPEC Authentication guard for protected routes
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import LoadingSpinner from './LoadingSpinner';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { accessToken, isAuthenticated, isLoading, loadUser } = useAuthStore();
  const location = useLocation();

  // Load user on mount if token exists but user not loaded
  useEffect(() => {
    if (accessToken && !isAuthenticated && !isLoading) {
      loadUser();
    }
  }, [accessToken, isAuthenticated, isLoading, loadUser]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return <LoadingSpinner message="인증 확인 중..." />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default AuthGuard;
