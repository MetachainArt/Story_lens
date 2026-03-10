import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';

type StoredDraft = {
  id: string;
  photoId: string;
  topic: string;
  content: string;
  created_at: string;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function findDraftForPhoto(photoId: string): StoredDraft | null {
  const drafts = safeJsonArray<StoredDraft>(localStorage.getItem('story_drafts'));
  return (
    drafts.find(
      (d): d is StoredDraft =>
        !!d &&
        typeof d === 'object' &&
        typeof d.photoId === 'string' &&
        typeof d.content === 'string' &&
        d.photoId === photoId,
    ) ?? null
  );
}

export default function GalleryDetailPage() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [draft, setDraft] = useState<StoredDraft | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPhoto = useCallback(async () => {
    if (!photoId) return;
    setIsLoading(true);

    // Try server first
    try {
      const response = await api.get(`/api/v1/photos/${photoId}`);
      if (response.data && typeof response.data === 'object') {
        setPhoto(response.data as Photo);
        setDraft(findDraftForPhoto(photoId));
        setIsLoading(false);
        return;
      }
    } catch {
      // fall through to local
    }

    // Try local saved_photos
    const saved = safeJsonArray<{
      id?: unknown;
      edited_url?: unknown;
      topic?: unknown;
      created_at?: unknown;
    }>(localStorage.getItem('saved_photos'));

    const local = saved.find(
      (item) => !!item && typeof item === 'object' && item.id === photoId,
    );

    if (
      local &&
      typeof local.id === 'string' &&
      typeof local.edited_url === 'string' &&
      typeof local.created_at === 'string'
    ) {
      setPhoto({
        id: local.id,
        session_id: 'local',
        user_id: 'local',
        original_url: local.edited_url,
        edited_url: local.edited_url,
        title: null,
        topic: typeof local.topic === 'string' ? local.topic : null,
        thumbnail_url: local.edited_url,
        created_at: local.created_at,
        updated_at: local.created_at,
      });
    }

    setDraft(findDraftForPhoto(photoId));
    setIsLoading(false);
  }, [photoId]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);

  if (isLoading) {
    return (
      <div
        className="story-page-shell"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
          불러오는 중...
        </p>
      </div>
    );
  }

  if (!photo) {
    return (
      <div className="story-page-shell">
        <PageHeader title="보관함" showBack onBack={() => navigate('/gallery')} />
        <main
          className="story-content-container"
          style={{ textAlign: 'center', paddingTop: 60 }}
        >
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>
            사진을 찾을 수 없어요
          </p>
          <SecondaryButton onClick={() => navigate('/gallery')} size="md">
            보관함으로 돌아가기
          </SecondaryButton>
        </main>
      </div>
    );
  }

  const imageUrl = resolveImageUrl(
    photo.edited_url || photo.thumbnail_url || photo.original_url,
  );

  return (
    <div className="story-page-shell">
      <PageHeader title="나의 기록" showBack onBack={() => navigate('/gallery')} />

      <main className="story-content-container" style={{ paddingBottom: 30 }}>
        {/* Photo */}
        <section
          className="story-surface-card"
          style={{
            overflow: 'hidden',
            marginBottom: 0,
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
          }}
        >
          <img
            src={imageUrl}
            alt={photo.title || '사진'}
            style={{
              width: '100%',
              display: 'block',
              maxHeight: 480,
              objectFit: 'contain',
              objectPosition: 'center',
              background: 'var(--color-bg-soft)',
            }}
          />
        </section>

        {/* Topic + Date + Content */}
        <section
          className="story-surface-card"
          style={{
            padding: '16px 18px 20px',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            borderTop: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            {photo.topic ? (
              <span
                style={{
                  display: 'inline-block',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(196,117,80,0.35)',
                  background: 'rgba(212,132,90,0.18)',
                  padding: '5px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                #{photo.topic}
              </span>
            ) : (
              <span />
            )}
            <span
              style={{
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              {formatDate(photo.created_at)}
            </span>
          </div>

          {draft ? (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 'var(--line-height-relaxed)',
                fontFamily: 'var(--font-family)',
                fontSize: '0.95rem',
                color: 'var(--color-text-primary)',
              }}
            >
              {draft.content}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '20px 0',
                color: 'var(--color-text-secondary)',
              }}
            >
              <p style={{ marginBottom: 4, fontSize: '0.95rem' }}>
                아직 글이 없어요
              </p>
              <p style={{ fontSize: '0.8rem' }}>
                사진에 어울리는 글을 써보세요
              </p>
            </div>
          )}
        </section>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 16 }}>
          <SecondaryButton
            onClick={() => {
              const imgUrl = photo.edited_url || photo.original_url;
              if (imgUrl?.startsWith('data:') || imgUrl?.startsWith('blob:')) {
                sessionStorage.setItem('dev_photo_url', imgUrl);
              } else {
                sessionStorage.removeItem('dev_photo_url');
              }
              navigate(`/edit/${photo.id}`);
            }}
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 8px' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3A8;</span>
            </span>
            <span>편집</span>
          </SecondaryButton>

          <SecondaryButton
            onClick={() =>
              navigate(`/write/${photo.id}`, {
                state: {
                  photoId: photo.id,
                  topic: photo.topic,
                  imageUrl: imageUrl,
                },
              })
            }
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 8px' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x270D;&#xFE0F;</span>
            </span>
            <span>{draft ? '글 수정' : '글쓰기'}</span>
          </SecondaryButton>

          <PrimaryButton
            onClick={() =>
              navigate(`/music/${photo.id}`, {
                state: {
                  topic: photo.topic,
                  imageUrl: imageUrl,
                  draftText: draft?.content || '',
                },
              })
            }
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 8px' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3B5;</span>
            </span>
            <span>음악</span>
          </PrimaryButton>
        </div>
      </main>
    </div>
  );
}
