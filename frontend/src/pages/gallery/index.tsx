/**
 * Gallery Page - Vintage Cute Style
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';

export default function GalleryPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    try {
      const saved = JSON.parse(localStorage.getItem('saved_photos') || '[]');
      const localPhotos: Photo[] = saved.map((p: any) => ({
        id: p.id,
        session_id: 'dev-session',
        user_id: 'dev-user',
        original_url: p.edited_url,
        edited_url: p.edited_url,
        thumbnail_url: p.edited_url,
        created_at: p.created_at,
      }));
      setPhotos(localPhotos);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-primary)' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FFF5EB 0%, #FCEBD5 100%)' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'linear-gradient(180deg, var(--color-surface) 0%, var(--color-bg-soft) 100%)',
          borderBottom: '1.5px solid var(--color-border)',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-text-primary)',
            padding: 8,
          }}
          aria-label="뒤로 가기"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h1 style={{ fontFamily: 'var(--font-family-serif)', fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-text-primary)', letterSpacing: '0.05em' }}>
          내 사진
        </h1>

        <div style={{ width: 40 }} />
      </header>

      <main style={{ padding: '20px 16px' }}>
        {photos.length === 0 ? (
          /* Empty state */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, gap: 20 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--color-border)',
              }}
            >
              <span style={{ fontSize: '2rem' }}>&#x1F4F7;</span>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 6, fontFamily: 'var(--font-family-serif)' }}>
                아직 사진이 없어요
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                첫 번째 사진을 찍어보세요!
              </p>
            </div>

            <button
              onClick={() => navigate('/camera')}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
                color: '#FFF8F0',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: 'var(--radius-2xl)',
                boxShadow: 'var(--shadow-cute)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
                fontSize: '1.05rem',
                fontWeight: 600,
              }}
            >
              &#x1F4F8; 사진 찍으러 가기
            </button>
          </div>
        ) : (
          /* Photo grid */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
            {photos.map((photo) => {
              const thumbnailUrl = photo.thumbnail_url || photo.edited_url || photo.original_url;
              return (
                <button
                  key={photo.id}
                  onClick={() => {
                    sessionStorage.setItem('dev_photo_url', thumbnailUrl);
                    navigate('/edit/dev-photo');
                  }}
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    border: '2px solid var(--color-border)',
                    boxShadow: 'var(--shadow-md)',
                    cursor: 'pointer',
                    background: 'var(--color-surface)',
                    padding: 0,
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
                >
                  <img
                    src={thumbnailUrl}
                    alt="사진"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />

                  {/* Date label */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(74,55,40,0.6))',
                      padding: '16px 8px 6px',
                    }}
                  >
                    <p style={{ color: '#FFF8F0', fontSize: '0.7rem', fontFamily: 'var(--font-family)' }}>
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
