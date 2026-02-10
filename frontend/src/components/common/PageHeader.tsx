/**
 * Vintage Cute PageHeader
 */
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export function PageHeader({ title, showBack = false, onBack, rightAction }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      style={{
        height: '60px',
        background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg-soft) 100%)',
        borderBottom: '1.5px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
      }}
    >
      <div style={{ flexShrink: 0, width: 40 }}>
        {showBack && (
          <button
            onClick={handleBack}
            style={{
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-lg)',
              border: 'none',
              background: 'none',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
            aria-label="뒤로 가기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </div>

      <h1
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: 'var(--font-family-serif)',
          fontSize: '1.3rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '0.05em',
        }}
      >
        {title}
      </h1>

      <div style={{ flexShrink: 0, width: 40, display: 'flex', justifyContent: 'flex-end' }}>
        {rightAction}
      </div>
    </header>
  );
}

export default PageHeader;
