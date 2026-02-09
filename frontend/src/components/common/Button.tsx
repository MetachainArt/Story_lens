/**
 * @TASK P1-S0-T1 - Button Components
 * @SPEC Primary and Secondary buttons with design tokens
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Primary Button
export function PrimaryButton({
  children,
  isLoading = false,
  fullWidth = false,
  size = 'md',
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const heightMap = {
    sm: 'var(--button-height-sm)',
    md: 'var(--button-height-md)',
    lg: 'var(--button-height-lg)',
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 px-6 rounded-lg
        font-semibold transition-all duration-200
        focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2
        disabled:cursor-not-allowed
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{
        height: heightMap[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        backgroundColor: disabled || isLoading ? 'var(--color-primary-disabled)' : 'var(--color-primary)',
        color: '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--color-primary)';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-active)';
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
        }
      }}
    >
      {isLoading ? (
        <>
          <div
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.6s' }}
          />
          <span>처리 중...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Secondary Button
export function SecondaryButton({
  children,
  isLoading = false,
  fullWidth = false,
  size = 'md',
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const heightMap = {
    sm: 'var(--button-height-sm)',
    md: 'var(--button-height-md)',
    lg: 'var(--button-height-lg)',
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 px-6 rounded-lg
        font-semibold transition-all duration-200
        focus:outline-none focus-visible:ring-4 focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{
        height: heightMap[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        backgroundColor: 'transparent',
        color: 'var(--color-primary)',
        border: '2px solid var(--color-primary)',
        borderRadius: 'var(--radius-lg)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.2)';
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
        }
      }}
    >
      {isLoading ? (
        <>
          <div
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.6s' }}
          />
          <span>처리 중...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
