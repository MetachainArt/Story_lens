/**
 * @TASK P3-S3-T1 - Photo Selection Page
 * @SPEC specs/screens/select.yaml
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import api from '@/services/api';

export default function SelectPage() {
  const navigate = useNavigate();
  const { capturedPhotos, sessionId } = useCameraStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Redirect to camera if no photos
  useEffect(() => {
    if (capturedPhotos.length === 0) {
      navigate('/camera', { replace: true });
    }
  }, [capturedPhotos, navigate]);

  // Create object URLs for all photos
  useEffect(() => {
    const urls = capturedPhotos.map((blob) => URL.createObjectURL(blob));
    setPhotoUrls(urls);

    // Cleanup on unmount
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [capturedPhotos]);

  // Handle previous photo
  const handlePrevious = () => {
    setCurrentIndex((prev) => {
      if (prev === 0) return capturedPhotos.length - 1;
      return prev - 1;
    });
  };

  // Handle next photo
  const handleNext = () => {
    setCurrentIndex((prev) => {
      if (prev === capturedPhotos.length - 1) return 0;
      return prev + 1;
    });
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  // Handle touch end (swipe detection)
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;

    // Swipe threshold: 50px
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        // Swipe left - next photo
        handleNext();
      } else {
        // Swipe right - previous photo
        handlePrevious();
      }
    }
  };

  // Handle retake
  const handleRetake = () => {
    navigate('/camera');
  };

  // Handle edit (upload and navigate)
  const handleEdit = async () => {
    if (!sessionId) {
      setError('세션 정보가 없습니다.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', capturedPhotos[currentIndex]);
      formData.append('session_id', sessionId);

      // Upload to server
      const response = await api.post('/api/v1/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const photoId = response.data.id;

      // Navigate to editor
      navigate(`/edit/${photoId}`);
    } catch (err) {
      console.error('Upload failed:', err);
      setError('업로드 실패. 다시 시도해주세요.');
      setIsUploading(false);
    }
  };

  // Don't render if no photos (will redirect)
  if (capturedPhotos.length === 0) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      {/* Photo Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* Photo Container */}
        <div
          className="relative w-full max-w-4xl"
          style={{
            aspectRatio: '4/3',
            maxHeight: '70vh',
          }}
        >
          {/* Photo */}
          <img
            src={photoUrls[currentIndex]}
            alt="사진 미리보기"
            className="w-full h-full object-contain"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#000',
            }}
          />

          {/* Navigation Buttons */}
          <button
            onClick={handlePrevious}
            aria-label="이전 사진"
            className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 transition-all shadow-lg"
            style={{
              width: '48px',
              height: '48px',
            }}
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
                strokeWidth={3}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <button
            onClick={handleNext}
            aria-label="다음 사진"
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white bg-opacity-80 hover:bg-opacity-100 transition-all shadow-lg"
            style={{
              width: '48px',
              height: '48px',
            }}
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
                strokeWidth={3}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Photo Indicator */}
        <div
          className="mt-6 px-4 py-2 rounded-full"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: '#FFFFFF',
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          {currentIndex + 1} / {capturedPhotos.length}
        </div>
      </div>

      {/* Action Buttons */}
      <div
        className="p-6 space-y-3"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-lg text-center"
            style={{
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            {error}
          </div>
        )}

        {/* Edit Button */}
        <PrimaryButton
          onClick={handleEdit}
          isLoading={isUploading}
          fullWidth
          size="lg"
          disabled={isUploading}
        >
          {isUploading ? '업로드 중...' : '이 사진 편집하기'}
        </PrimaryButton>

        {/* Retake Button */}
        <SecondaryButton onClick={handleRetake} fullWidth size="lg">
          다시 찍기
        </SecondaryButton>
      </div>
    </div>
  );
}
