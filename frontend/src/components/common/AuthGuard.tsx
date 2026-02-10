/**
 * AuthGuard - DEV: disabled for testing
 */
interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  return <>{children}</>;
}

export default AuthGuard;
