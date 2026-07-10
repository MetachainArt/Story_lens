/**
 * @TASK P1-S0-T1 - LoadingSpinner Component
 * @SPEC Full-screen or inline loading spinner with mascot illustration
 */
import loadingImg from '@/assets/illustrations/loading.webp';

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
        <img
          src={loadingImg}
          alt=""
          style={{ width: 100, height: 100, objectFit: 'contain', animation: 'glass-float 2s ease-in-out infinite' }}
        />

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
