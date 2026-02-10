/**
 * Photo Selection Page - Vintage Cute Style
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';

export default function SelectPage() {
  const navigate = useNavigate();
  const { capturedPhotos } = useCameraStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    if (capturedPhotos.length === 0) {
      navigate('/camera', { replace: true });
    }
  }, [capturedPhotos, navigate]);

  useEffect(() => {
    const urls = capturedPhotos.map((blob) => URL.createObjectURL(blob));
    setPhotoUrls(urls);
    return () => { urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [capturedPhotos]);

  const handlePrevious = () => {
    setCurrentIndex((prev) => prev === 0 ? capturedPhotos.length - 1 : prev - 1);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => prev === capturedPhotos.length - 1 ? 0 : prev + 1);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? handleNext() : handlePrevious();
    }
  };

  const handleEdit = () => {
    const blob = capturedPhotos[currentIndex];
    const blobUrl = URL.createObjectURL(blob);
    sessionStorage.setItem('dev_photo_url', blobUrl);
    navigate('/edit/dev-photo');
  };

  if (capturedPhotos.length === 0) return null;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(160deg, #FFF5EB 0%, #FCEBD5 100%)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          fontFamily: 'var(--font-family-serif)',
          fontSize: '1.2rem',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '0.05em',
        }}
      >
        사진 고르기
      </div>

      {/* Photo preview */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 500,
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-2xl)',
            border: '2px solid var(--color-border)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Photo */}
          <img
            src={photoUrls[currentIndex]}
            alt="미리보기"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              width: '100%',
              aspectRatio: '4/3',
              objectFit: 'cover',
              display: 'block',
            }}
          />

          {/* Nav arrows */}
          {capturedPhotos.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                aria-label="이전"
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255,248,240,0.9)',
                  border: '1.5px solid var(--color-border)',
                  boxShadow: 'var(--shadow-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                &#x25C0;
              </button>
              <button
                onClick={handleNext}
                aria-label="다음"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255,248,240,0.9)',
                  border: '1.5px solid var(--color-border)',
                  boxShadow: 'var(--shadow-md)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                &#x25B6;
              </button>
            </>
          )}

          {/* Photo counter */}
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(74,55,40,0.7)',
              color: '#FFF8F0',
              padding: '4px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-family)',
              fontWeight: 600,
            }}
          >
            {currentIndex + 1} / {capturedPhotos.length}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          maxWidth: 500,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <button
          onClick={handleEdit}
          style={{
            width: '100%',
            height: 56,
            background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
            color: '#FFF8F0',
            border: '2px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--radius-2xl)',
            boxShadow: 'var(--shadow-cute)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: '1.1rem',
            fontWeight: 600,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          &#x2728; 이 사진 편집하기
        </button>

        <button
          onClick={() => navigate('/camera')}
          style={{
            width: '100%',
            height: 48,
            background: 'var(--color-surface)',
            color: 'var(--color-text-secondary)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-2xl)',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
            fontSize: '1rem',
            transition: 'all 0.3s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
          다시 찍기
        </button>
      </div>
    </div>
  );
}
