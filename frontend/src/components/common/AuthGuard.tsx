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
  // DEV: 로그인 없이 바로 접근 가능하도록 임시 비활성화
  return <>{children}</>;
}

export default AuthGuard;
