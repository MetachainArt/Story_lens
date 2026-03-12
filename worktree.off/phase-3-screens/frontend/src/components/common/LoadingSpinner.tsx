/**
 * @TASK P1-S0-T1 - LoadingSpinner Component
 * @SPEC Full-screen or inline loading spinner
 */

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  message?: string;
}

export function LoadingSpinner({ fullScreen = true, message }: LoadingSpinnerProps) {
  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-90 z-50'
    : 'flex items-center justify-center p-8';

  return (
    <div className={containerClass} role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        {/* Spinner */}
        <div className="relative w-12 h-12">
          <div
            className="absolute inset-0 border-4 border-gray-200 rounded-full"
            style={{ borderColor: 'var(--color-border)' }}
          />
          <div
            className="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
            style={{
              borderTopColor: 'var(--color-primary)',
              animationDuration: '0.8s',
            }}
          />
        </div>

        {/* Message */}
        {message && (
          <p
            className="text-base font-medium"
            style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoadingSpinner;
