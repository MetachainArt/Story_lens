import { getUserStorage, type UserStorage } from '@/utils/userStorage';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Photo, PhotoPageResponse } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import emptyGalleryImg from '@/assets/illustrations/empty-gallery.webp';

type SavedPhotoRecord = {
  id: string;
  edited_url: string;
  topic: string | null;
  created_at: string;
};

function readLocalSavedPhotos(userLocalStorage: UserStorage): SavedPhotoRecord[] {
  const saved = safeJsonArray<{
    id?: unknown;
    edited_url?: unknown;
    topic?: unknown;
    created_at?: unknown;
  }>(userLocalStorage.getItem('saved_photos'));

  return saved.filter(
    (item): item is SavedPhotoRecord =>
      !!item &&
      typeof item === 'object' &&
      typeof item.id === 'string' &&
      typeof item.edited_url === 'string' &&
      (item.topic === null || typeof item.topic === 'string') &&
      typeof item.created_at === 'string',
  );
}

export default function GalleryPage() {
  const [userLocalStorage] = useState(() => getUserStorage());
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const selectForRetouch = searchParams.get('selectFor') === 'retouch';
  const returnTemplateId = searchParams.get('templateId');
  const { user } = useAuthStore();
  const isParent = user?.role === 'parent';
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const loadLocalPhotos = useCallback((): Photo[] => {
    const normalized = readLocalSavedPhotos(userLocalStorage);

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
  }, [userLocalStorage]);

  const loadPhotos = useCallback(async (offset = 0) => {
    const isFirstPage = offset === 0;
    if (isFirstPage) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }
    try {
      const response = await api.get<PhotoPageResponse>('/api/v1/photos/page', {
        params: { offset, limit: 24 },
      });
      const data = Array.isArray(response.data?.items) ? response.data.items : [];
      const localPhotos = isFirstPage ? loadLocalPhotos().filter(local => !data.some(item => item.id === local.id)) : [];
      setPhotos((previous) => isFirstPage ? [...data, ...localPhotos] : [
        ...previous,
        ...data.filter((item) => !previous.some((photo) => photo.id === item.id)),
      ]);
      setNextOffset(response.data?.next_offset ?? null);
    } catch {
      if (isFirstPage) {
        const localPhotos = loadLocalPhotos();
        if (localPhotos.length > 0) {
          setPhotos(localPhotos);
          setNextOffset(null);
        } else {
          setPhotos([]);
          setError('불러온 사진이 없어요');
        }
      } else {
        setActionError('다음 사진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
      }
    } finally {
      if (isFirstPage) setIsLoading(false);
      else setIsLoadingMore(false);
    }
  }, [loadLocalPhotos]);

  useEffect(() => {
    void loadPhotos(0);
  }, [loadPhotos]);

  const handleDelete = async (photoId: string) => {
    const localPhotos = readLocalSavedPhotos(userLocalStorage);
    const targetPhoto = photos.find((photo) => photo.id === photoId);
    const isLocalOnly = Boolean(
      photoId.startsWith('local-') ||
      targetPhoto?.user_id === 'dev-user',
    );

    setActionError(null);
    setDeletingPhotoId(photoId);

    try {
      if (!isLocalOnly) {
        await api.delete(`/api/v1/photos/${photoId}`);
      }

      const updated = localPhotos.filter((item) => item.id !== photoId);
      userLocalStorage.setItem('saved_photos', JSON.stringify(updated));
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      setNextOffset((previous) => previous === null ? null : Math.max(0, previous - 1));
      setDeleteTarget(null);
    } catch {
      setDeleteTarget(null);
      setActionError('사진을 삭제하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setDeletingPhotoId(null);
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  const openPhoto = (photoId: string) => {
    if (selectForRetouch) {
      const params = new URLSearchParams({ sourcePhotoId: photoId });
      if (returnTemplateId) params.set('templateId', returnTemplateId);
      navigate(`/ai-retouch?${params.toString()}`);
      return;
    }
    navigate(`/gallery/${photoId}`);
  };

  if (isLoading) {
    return (
      <div className="story-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="story-page-shell story-bg-creative">
      <PageHeader
        title={selectForRetouch ? '보정할 사진 선택' : isParent ? '사진 보기' : '보관함'}
        showBack
        onBack={() => selectForRetouch ? navigate('/ai-retouch') : navigate('/')}
      />

      <main className="story-content-container">
        {selectForRetouch && (
          <section className="gallery-selection-banner">
            <strong>AI사진보정에 사용할 사진을 골라 주세요</strong>
            <span>사진을 누르면 선택한 보정 카드로 돌아가요.</span>
          </section>
        )}
        {actionError && (
          <section
            role="alert"
            className="story-surface-card"
            style={{
              marginBottom: 14,
              padding: '14px 16px',
              borderColor: 'rgba(211, 88, 71, 0.28)',
              background: 'rgba(255, 238, 233, 0.92)',
              color: '#9A3D2F',
              fontWeight: 800,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="삭제 오류 닫기"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '1px solid rgba(154,61,47,0.22)',
                background: 'rgba(255,255,255,0.58)',
                color: '#9A3D2F',
                fontWeight: 900,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              &times;
            </button>
          </section>
        )}

        {error ? (
          <section className="story-surface-card" style={{ padding: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 12 }}>{error}</p>
            <SecondaryButton onClick={() => loadPhotos(0)} size="md" aria-label="다시 가져오기" className="story-cta-with-icon">
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
            <img src={emptyGalleryImg} alt="" style={{ width: 160, height: 120, objectFit: 'contain' }} />

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
          <div className="gallery-grid">
            {photos.map((photo) => {
              const thumbnailUrl = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);

              return (
                <div
                  key={photo.id}
                  className="polaroid-card"
                  style={{ position: 'relative' }}
                >
                  <button
                    onClick={() => openPhoto(photo.id)}
                    aria-label={selectForRetouch ? '이 사진 선택' : '사진 상세 보기'}
                    style={{
                      width: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <img src={thumbnailUrl} alt={photo.title || '사진'} />
                  </button>

                  {!isParent && !selectForRetouch && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionError(null);
                        setDeleteTarget(photo.id);
                      }}
                      aria-label="삭제"
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'rgba(0,0,0,0.4)',
                        backdropFilter: 'blur(6px)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#FFF8F0',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 5,
                      }}
                    >
                      &times;
                    </button>
                  )}

                  <span className="polaroid-caption">{formatDate(photo.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
        {nextOffset !== null && !error && (
          <div className="gallery-load-more">
            <SecondaryButton
              onClick={() => loadPhotos(nextOffset)}
              disabled={isLoadingMore}
              size="md"
            >
              {isLoadingMore ? '다음 사진 불러오는 중...' : '사진 더 보기'}
            </SecondaryButton>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <SecondaryButton
            onClick={() => selectForRetouch
              ? navigate(returnTemplateId ? `/ai-retouch?templateId=${returnTemplateId}` : '/ai-retouch')
              : navigate('/')}
            fullWidth
            className="story-cta-with-icon"
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">{selectForRetouch ? '‹' : '\u{1F3E0}'}</span>
            </span>
            <span>{selectForRetouch ? '보정으로 돌아가기' : '홈으로'}</span>
          </SecondaryButton>
        </div>
      </main>

      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="사진 삭제"
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
                disabled={deletingPhotoId === deleteTarget}
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
                {deletingPhotoId === deleteTarget ? '삭제 중...' : '삭제'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
