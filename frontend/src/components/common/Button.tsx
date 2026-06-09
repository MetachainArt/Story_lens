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

const HEIGHT_MAP: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'var(--button-height-sm)',
  md: 'var(--button-height-md)',
  lg: 'var(--button-height-lg)',
};

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
        height: HEIGHT_MAP[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-family)',
        background: disabled || isLoading
          ? 'var(--color-primary-disabled)'
          : 'linear-gradient(135deg, #526f9f 0%, #df8e62 100%)',
        color: '#FFFFFF',
        border: '1px solid rgba(255,255,255,0.5)',
        borderRadius: 8,
        boxShadow: disabled ? 'none' : '0 18px 34px rgba(82, 111, 159, 0.18)',
        letterSpacing: 0,
        transition: 'all 0.3s var(--easing-bounce)',
        transform: 'translateY(0)',
        ...customStyle,
      }}
    >
      {isLoading ? (
        <>
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ animationDuration: '0.6s' }} />
          <span>로딩 중...</span>
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
        height: HEIGHT_MAP[size],
        fontSize: 'var(--font-size-button)',
        fontWeight: 'var(--font-weight-semibold)',
        fontFamily: 'var(--font-family)',
        backgroundColor: 'var(--color-surface)',
        color: '#475467',
        border: '1px solid rgba(137, 154, 184, 0.3)',
        borderRadius: 8,
        boxShadow: '0 8px 20px rgba(75, 89, 118, 0.07)',
        letterSpacing: 0,
        transition: 'all 0.3s var(--easing-bounce)',
        transform: 'translateY(0)',
        ...customStyle,
      }}
    >
      {isLoading ? (
        <>
          <div
            className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
            style={{ animationDuration: '0.6s' }}
          />
          <span>로딩 중...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
