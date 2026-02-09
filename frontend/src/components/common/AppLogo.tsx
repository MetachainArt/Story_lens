/**
 * @TASK P1-S1-T1 - AppLogo Component
 * @SPEC Story Lens logo with size variations
 */

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  const sizeMap = {
    sm: {
      container: 'h-12',
      text: 'text-2xl',
      icon: 'w-8 h-8',
    },
    md: {
      container: 'h-16',
      text: 'text-3xl',
      icon: 'w-12 h-12',
    },
    lg: {
      container: 'h-24',
      text: 'text-5xl',
      icon: 'w-16 h-16',
    },
  };

  const { container, text, icon } = sizeMap[size];

  return (
    <div className={`flex items-center gap-3 ${container} ${className}`}>
      {/* Camera Icon with Lens */}
      <div className={`${icon} relative flex items-center justify-center`}>
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Camera body */}
          <rect
            x="8"
            y="18"
            width="48"
            height="36"
            rx="6"
            style={{ fill: 'var(--color-primary)' }}
          />
          {/* Top viewfinder bump */}
          <path
            d="M24 18L26 12H38L40 18H24Z"
            style={{ fill: 'var(--color-primary)' }}
          />
          {/* Lens */}
          <circle
            cx="32"
            cy="36"
            r="12"
            style={{ fill: 'var(--color-bg-light)' }}
          />
          <circle
            cx="32"
            cy="36"
            r="8"
            style={{ fill: 'var(--color-secondary)' }}
            opacity="0.8"
          />
          {/* Lens reflection */}
          <path
            d="M28 32C28 30 29 29 30 29C31 29 31.5 29.5 31.5 30.5"
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          {/* Shutter button */}
          <circle
            cx="48"
            cy="24"
            r="2"
            style={{ fill: 'var(--color-bg-light)' }}
          />
        </svg>
      </div>

      {/* Logo text */}
      <div className="flex flex-col justify-center">
        <h1
          className={`${text} font-bold leading-none`}
          style={{
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text-primary)',
          }}
        >
          Story Lens
        </h1>
        <p
          className="text-sm mt-1"
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: size === 'lg' ? '1rem' : '0.875rem',
          }}
        >
          스토리 렌즈
        </p>
      </div>
    </div>
  );
}

export default AppLogo;
