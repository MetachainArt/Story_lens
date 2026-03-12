/**
 * @TASK P3-S6-T1 - Gallery Page Implementation
 * @SPEC specs/screens/gallery.yaml
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import { PageHeader } from '@/components/common/PageHeader';
import { PrimaryButton } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import type { Photo } from '@/types/photo';

export default function GalleryPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<Photo[]>('/api/v1/photos');
      setPhotos(response.data);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
      setError('사진을 불러올 수 없습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  const handlePhotoClick = (photoId: string) => {
    navigate(`/edit/${photoId}`);
  };

  const handleGoToCamera = () => {
    navigate('/camera');
  };

  const handleBack = () => {
    navigate('/');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="불러오는 중..." />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      <PageHeader title="내 사진" showBack onBack={handleBack} />

      <main className="px-4 py-6">
        {error ? (
          // Error State
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <p
              className="text-center text-base"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {error}
            </p>
            <PrimaryButton onClick={fetchPhotos} size="md">
              다시 시도
            </PrimaryButton>
          </div>
        ) : photos.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
            {/* Camera Icon */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                backgroundColor: 'var(--color-primary-light)',
              }}
            >
              <svg
                className="w-10 h-10"
                style={{ color: 'var(--color-primary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>

            <div className="text-center">
              <p
                className="text-xl font-semibold mb-2"
                style={{ color: 'var(--color-text-primary)' }}
              >
                아직 사진이 없어요
              </p>
              <p
                className="text-base"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                첫 번째 사진을 찍어보세요
              </p>
            </div>

            <PrimaryButton onClick={handleGoToCamera} size="lg">
              사진 찍으러 가기
            </PrimaryButton>
          </div>
        ) : (
          // Photo Grid
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {photos.map((photo) => {
              const thumbnailUrl =
                photo.thumbnail_url || photo.edited_url || photo.original_url;

              return (
                <button
                  key={photo.id}
                  onClick={() => handlePhotoClick(photo.id)}
                  className="relative rounded-lg overflow-hidden shadow-md transition-transform hover:scale-105 active:scale-95"
                  style={{
                    aspectRatio: '1/1',
                    backgroundColor: 'var(--color-surface)',
                  }}
                >
                  <img
                    src={thumbnailUrl}
                    alt={photo.title || '사진'}
                    className="w-full h-full object-cover"
                  />

                  {/* Date Overlay */}
                  <div
                    className="absolute bottom-0 left-0 right-0 px-2 py-1"
                    style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <p
                      className="text-xs text-white"
                      style={{ fontSize: '0.75rem' }}
                    >
                      {formatDate(photo.created_at)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
