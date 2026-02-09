/**
 * @TASK P1-S0-T1 - PageHeader Component
 * @SPEC Common page header with back button and title
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
      className="flex items-center justify-between px-4 bg-white border-b"
      style={{
        height: '56px',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Left: Back Button or Spacer */}
      <div className="flex-shrink-0 w-10">
        {showBack && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center rounded-lg transition-colors"
            style={{
              width: '40px',
              height: '40px',
              color: 'var(--color-text-primary)',
            }}
            aria-label="뒤로 가기"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Center: Title */}
      <h1
        className="flex-1 text-center font-semibold"
        style={{
          fontSize: 'var(--font-size-h3)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
        }}
      >
        {title}
      </h1>

      {/* Right: Action or Spacer */}
      <div className="flex-shrink-0 w-10 flex justify-end">
        {rightAction}
      </div>
    </header>
  );
}

export default PageHeader;
