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
    <header className="story-page-header">
      <div className="story-page-header__left">
        {showBack && (
          <button
            onClick={handleBack}
            className="story-page-back"
            aria-label="뒤로가기"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-soft" aria-hidden="true">
              <span className="story-icon-emoji">←</span>
            </span>
          </button>
        )}
      </div>

      <h1 className="story-page-title">
        {title}
      </h1>

      <div className="story-page-header__right">{rightAction}</div>
    </header>
  );
}

export default PageHeader;
