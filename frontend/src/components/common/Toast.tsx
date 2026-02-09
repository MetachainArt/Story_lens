/**
 * @TASK P1-S0-T1 - Toast Component
 * @SPEC Toast notification component (error/success)
 */
import { useEffect, useState } from 'react';

interface ToastProps {
  type: 'error' | 'success';
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, message, onClose, duration = 3000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 10);

    // Auto dismiss
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for slide out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === 'error' ? 'var(--color-error)' : 'var(--color-success)';

  return (
    <div
      className="fixed bottom-0 left-0 right-0 px-4 pb-6 flex justify-center transition-transform duration-300 z-50"
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      <div
        className="flex items-center gap-3 px-6 py-4 rounded-lg shadow-xl text-white max-w-md w-full"
        style={{
          backgroundColor: bgColor,
        }}
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {type === 'error' ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <p className="flex-1 font-medium" style={{ fontSize: 'var(--font-size-base)' }}>
          {message}
        </p>

        {/* Close Button */}
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="닫기"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// Error Toast
interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function ErrorToast(props: ErrorToastProps) {
  return <Toast type="error" {...props} />;
}

// Success Toast
interface SuccessToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function SuccessToast(props: SuccessToastProps) {
  return <Toast type="success" {...props} />;
}

export default Toast;
