import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';

export default function GalleryPage() {
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLocalPhotos = useCallback((): Photo[] => {
    const saved = safeJsonArray<{
      id?: unknown;
      edited_url?: unknown;
      topic?: unknown;
      created_at?: unknown;
    }>(localStorage.getItem('saved_photos'));

    const normalized = saved.filter(
      (item): item is { id: string; edited_url: string; topic: string | null; created_at: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof item.edited_url === 'string' &&
        typeof item.id === 'string' &&
        (item.topic === null || typeof item.topic === 'string') &&
        typeof item.created_at === 'string',
    );

    return normalized.map((item) => ({
      id: item.id,
      session_id: 'dev-session',
      user_id: 'dev-user',
      original_url: item.edited_url,
      edited_url: item.edited_url,
      title: null,
      topic: item.topic,
      thumbnail_url: item.edited_url,
      content: null,
      music_url: null,
      created_at: item.created_at,
      updated_at: item.created_at,
    }));
  }, []);

  const loadPhotos = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/v1/photos');
      const data = Array.isArray(response.data) ? response.data : [];
      setPhotos(data);
    } catch {
      const localPhotos = loadLocalPhotos();
      if (localPhotos.length > 0) {
        setPhotos(localPhotos);
      } else {
        setPhotos([]);
        setError('불러온 사진이 없어요');
      }
    } finally {
      setIsLoading(false);
    }
  }, [loadLocalPhotos]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleDelete = async (photoId: string) => {
    try {
      await api.delete(`/api/v1/photos/${photoId}`);
    } catch {
      // API 실패 시 localStorage fallback
    }

    // localStorage에서도 제거
    const saved = safeJsonArray<{
      id?: unknown;
      edited_url?: unknown;
      topic?: unknown;
      created_at?: unknown;
    }>(localStorage.getItem('saved_photos'));

    const updated = saved.filter(
      (item): item is { id: string; edited_url: string; topic: string | null; created_at: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.edited_url === 'string' &&
        (item.topic === null || typeof item.topic === 'string') &&
        typeof item.created_at === 'string' &&
        item.id !== photoId,
    );

    localStorage.setItem('saved_photos', JSON.stringify(updated));
    setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
    setDeleteTarget(null);
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="story-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="story-page-shell">
      <PageHeader title="보관함" showBack onBack={() => navigate('/')} />

      <main className="story-content-container">
        {error ? (
          <section className="story-surface-card" style={{ padding: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 12 }}>{error}</p>
            <SecondaryButton onClick={loadPhotos} size="md" aria-label="다시 가져오기" className="story-cta-with-icon">
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F504;</span>
              </span>
              <span>다시 가져오기</span>
            </SecondaryButton>
          </section>
        ) : photos.length === 0 ? (
          <section
            className="story-surface-card"
            style={{
              minHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 24,
            }}
          >
            <div
              className="story-icon-3d"
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
              <p
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 6,
                  fontFamily: 'var(--font-family-serif)',
                }}
              >
                기록된 사진이 없어요
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>촬영 후 편집하고 보관해보세요</p>
            </div>

            <PrimaryButton
              onClick={() => navigate('/camera')}
              size="md"
              className="story-cta-with-icon"
              style={{ minWidth: 220 }}
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F4F8;</span>
              </span>
              <span>사진 촬영하기</span>
            </PrimaryButton>
          </section>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {photos.map((photo) => {
              const thumbnailUrl = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);

              return (
                <div
                  key={photo.id}
                  className="story-surface-card"
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: 'var(--radius-2xl)',
                    overflow: 'hidden',
                    border: '1.5px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    background: 'var(--color-surface)',
                    transition: 'transform var(--duration-fast) var(--easing-ease-out)',
                  }}
                >
                  <button
                    onClick={() => navigate(`/gallery/${photo.id}`)}
                    aria-label="사진 상세 보기"
                    className="story-cta-primary"
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
                    <img src={thumbnailUrl} alt={photo.title || '사진'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(photo.id);
                    }}
                    aria-label="삭제"
                    className="story-cta-with-icon"
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      width: 44,
                      height: 44,
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
                    <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                      <span className="story-icon-emoji">&times;</span>
                    </span>
                  </button>

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
                    <p style={{ color: '#FFF8F0', fontSize: '0.7rem', fontFamily: 'var(--font-family)' }}>{formatDate(photo.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <SecondaryButton onClick={() => navigate('/')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3E0;</span>
            </span>
            <span>홈으로</span>
          </SecondaryButton>
        </div>
      </main>

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
            className="story-surface-card"
            style={{
              padding: '28px 24px',
              maxWidth: 320,
              width: '86%',
              textAlign: 'center',
            }}
          >
            <div className="story-icon-3d" style={{ margin: '0 auto 12px', width: 54, height: 54 }}>
              <span className="story-icon-emoji">&#x1F5D1;</span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-family-serif)',
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: 6,
              }}
            >
              사진 삭제
            </p>
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                marginBottom: 20,
                fontFamily: 'var(--font-family)',
              }}
            >
              삭제하면 복구할 수 없어요
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <SecondaryButton onClick={() => setDeleteTarget(null)} size="md" style={{ flex: 1, padding: 0 }}>
                취소
              </SecondaryButton>
              <PrimaryButton
                onClick={() => handleDelete(deleteTarget)}
                size="md"
                className="story-cta-with-icon"
                style={{
                  flex: 1,
                  padding: 0,
                  background: 'linear-gradient(135deg, #C45050 0%, #A03E3E 100%)',
                }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">&#x1F5D1;</span>
                </span>
                삭제
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
