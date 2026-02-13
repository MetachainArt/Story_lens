/**
 * Gallery Page - Vintage Cute Style
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';

export default function GalleryPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const loadPhotos = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('saved_photos') || '[]');
      const localPhotos: Photo[] = saved.map((p: any) => ({
        id: p.id,
        session_id: 'dev-session',
        user_id: 'dev-user',
        original_url: p.edited_url,
        edited_url: p.edited_url,
        title: null,
        topic: p.topic ?? null,
        thumbnail_url: p.edited_url,
        created_at: p.created_at,
        updated_at: p.created_at,
      }));
      setPhotos(localPhotos);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadPhotos();
    setIsLoading(false);
  }, [loadPhotos]);

  const handleDelete = (photoId: string) => {
    const saved = JSON.parse(localStorage.getItem('saved_photos') || '[]');
    const updated = saved.filter((p: any) => p.id !== photoId);
    localStorage.setItem('saved_photos', JSON.stringify(updated));
    loadPhotos();
    setDeleteTarget(null);
  };

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
                <div
                  key={photo.id}
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    border: '2px solid var(--color-border)',
                    boxShadow: 'var(--shadow-md)',
                    background: 'var(--color-surface)',
                    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; }}
                >
                  {/* Photo (click to edit) */}
                  <button
                    onClick={() => {
                      sessionStorage.setItem('dev_photo_url', thumbnailUrl);
                      navigate('/edit/dev-photo');
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <img
                      src={thumbnailUrl}
                      alt="사진"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(photo.id);
                    }}
                    aria-label="삭제"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      background: 'rgba(0,0,0,0.45)',
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#FFF8F0',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      zIndex: 5,
                    }}
                  >
                    &times;
                  </button>

                  {/* Date label */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(74,55,40,0.6))',
                      padding: '16px 8px 6px',
                      pointerEvents: 'none',
                    }}
                  >
                    <p style={{ color: '#FFF8F0', fontSize: '0.7rem', fontFamily: 'var(--font-family)' }}>
                      {formatDate(photo.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          onClick={() => setDeleteTarget(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(74,55,40,0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-2xl)',
              border: '2px solid var(--color-border)',
              boxShadow: 'var(--shadow-lg)',
              padding: '28px 24px',
              maxWidth: 300,
              width: '85%',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: 12 }}>&#x1F5D1;</div>
            <p style={{
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.1rem',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: 6,
            }}>
              사진을 삭제할까요?
            </p>
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--color-text-secondary)',
              marginBottom: 20,
              fontFamily: 'var(--font-family)',
            }}>
              삭제하면 되돌릴 수 없어요
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: 'var(--color-bg-soft)',
                  color: 'var(--color-text-primary)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  background: 'linear-gradient(135deg, #C45050 0%, #A03E3E 100%)',
                  color: '#FFF8F0',
                  border: '2px solid rgba(255,255,255,0.15)',
                  borderRadius: 'var(--radius-xl)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(196,80,80,0.3)',
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
