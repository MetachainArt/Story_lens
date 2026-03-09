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
      <div className={`story-icon-3d story-icon-3d-primary ${icon}`} aria-hidden="true">
        <span className="story-icon-emoji">📷</span>
      </div>

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
          이야기의 모험을 담다
        </p>
      </div>
    </div>
  );
}

export default AppLogo;
