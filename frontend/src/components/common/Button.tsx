/**
 * Vintage Cute Button Components
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  isLoading?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PrimaryButton({
  children,
  isLoading = false,
  fullWidth = false,
  size = 'md',
  disabled,
  className = '',
  style: customStyle,
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
        inline-flex items-center justify-center gap-3 px-8
        font-semibold transition-all
        disabled:cursor-not-allowed
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{
        height: heightMap[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-family)',
        background: disabled || isLoading
          ? 'var(--color-primary-disabled)'
          : 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
        color: '#FFF8F0',
        border: '2px solid rgba(255,255,255,0.2)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: disabled ? 'none' : 'var(--shadow-cute), inset 0 1px 0 rgba(255,255,255,0.2)',
        letterSpacing: '0.02em',
        transition: 'all 0.3s var(--easing-bounce)',
        transform: 'translateY(0)',
        ...customStyle,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 24px rgba(212, 132, 90, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'var(--shadow-cute), inset 0 1px 0 rgba(255,255,255,0.2)';
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(1px)';
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
        }
      }}
    >
      {isLoading ? (
        <>
          <div
            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.6s' }}
          />
          <span>잠깐만요...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({
  children,
  isLoading = false,
  fullWidth = false,
  size = 'md',
  disabled,
  className = '',
  style: customStyle,
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
        inline-flex items-center justify-center gap-3 px-8
        font-semibold transition-all
        disabled:cursor-not-allowed disabled:opacity-50
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      style={{
        height: heightMap[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-family)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-primary)',
        border: '2px dashed var(--color-border)',
        borderRadius: 'var(--radius-2xl)',
        boxShadow: 'var(--shadow-sm)',
        letterSpacing: '0.02em',
        transition: 'all 0.3s var(--easing-bounce)',
        transform: 'translateY(0)',
        ...customStyle,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.borderColor = 'var(--color-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-primary-light)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isLoading) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.borderColor = 'var(--color-border)';
          e.currentTarget.style.backgroundColor = 'var(--color-surface)';
        }
      }}
    >
      {isLoading ? (
        <>
          <div
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.6s' }}
          />
          <span>잠깐만요...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
