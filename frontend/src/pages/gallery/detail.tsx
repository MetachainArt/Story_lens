import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Photo } from '@/types/photo';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { safeJsonArray, resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function findLocalDraft(photoId: string): string | null {
  const drafts = safeJsonArray<{ photoId?: unknown; content?: unknown }>(
    localStorage.getItem('story_drafts'),
  );
  const found = drafts.find(
    (d) =>
      !!d &&
      typeof d === 'object' &&
      typeof d.photoId === 'string' &&
      typeof d.content === 'string' &&
      d.photoId === photoId,
  );
  return found && typeof found.content === 'string' ? found.content : null;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|iPhone|iPad|iPod|Mobile|SamsungBrowser/i.test(navigator.userAgent) ||
    navigator.maxTouchPoints > 0 ||
    (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches)
  );
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

export default function GalleryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { photoId } = useParams<{ photoId: string }>();
  const routeState = location.state as { fromAiGeneration?: boolean } | null;
  const isAiGenerationResult = routeState?.fromAiGeneration === true;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [savePreviewUrl, setSavePreviewUrl] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadPhoto = useCallback(async () => {
    if (!photoId) return;
    setIsLoading(true);

    // Try server first
    try {
      const response = await api.get(`/api/v1/photos/${photoId}`);
      if (response.data && typeof response.data === 'object') {
        const p = response.data as Photo;
        setPhoto(p);
        // Server content takes priority, fall back to localStorage
        setDraftContent(p.content || findLocalDraft(photoId));
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
        content: null,
        music_url: null,
        created_at: local.created_at,
        updated_at: local.created_at,
      });
    }

    setDraftContent(findLocalDraft(photoId));
    setIsLoading(false);
  }, [photoId]);

  useEffect(() => {
    loadPhoto();
  }, [loadPhoto]);

  useEffect(() => {
    return () => {
      if (savePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(savePreviewUrl);
      }
    };
  }, [savePreviewUrl]);

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

  const handleDownload = async () => {
    // Vercel 프록시 경로로 변환 (CORS 우회)
    const apiBase = (import.meta.env.VITE_API_URL?.trim() || '').replace(/\/+$/, '');
    const proxyUrl = apiBase && imageUrl.startsWith(apiBase)
      ? imageUrl.slice(apiBase.length)
      : imageUrl;

    setIsSavingImage(true);
    setSaveMessage(null);
    try {
      const response = await fetch(proxyUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('fetch failed');
      const blob = await response.blob();
      const imageType = blob.type || 'image/jpeg';
      const file = new File(
        [blob],
        `story_${photo.id || 'photo'}.${extensionForMimeType(imageType)}`,
        { type: imageType },
      );

      const canShareFile =
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [file] }));

      if (isMobileBrowser() && canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: 'Story Lens 사진',
            text: '완성된 사진을 저장해 주세요.',
          });
          setSaveMessage('공유 창에서 이미지 저장을 선택하면 사진첩에 저장돼요.');
          return;
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === 'AbortError') {
            setSaveMessage('저장을 취소했어요. 필요하면 다시 눌러 주세요.');
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      if (isMobileBrowser()) {
        if (savePreviewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(savePreviewUrl);
        }
        setSavePreviewUrl(url);
        setSaveMessage('사진을 길게 누른 뒤 이미지 저장을 선택하면 사진첩에 저장돼요.');
        return;
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSaveMessage('사진 다운로드를 시작했어요.');
    } catch {
      setSavePreviewUrl(proxyUrl || imageUrl);
      setSaveMessage('사진이 열리면 길게 눌러 이미지 저장을 선택해 주세요.');
    } finally {
      setIsSavingImage(false);
    }
  };

  const closeSavePreview = () => {
    if (savePreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(savePreviewUrl);
    }
    setSavePreviewUrl(null);
  };

  return (
    <div className="story-page-shell">
      <PageHeader title="나의 기록" showBack onBack={() => navigate('/gallery')} />

      <main className="story-content-container" style={{ paddingBottom: 30 }}>
        {isAiGenerationResult && (
          <section
            className="story-surface-card"
            style={{
              marginBottom: 14,
              padding: '18px',
              borderColor: 'rgba(82, 116, 169, 0.26)',
              background:
                'linear-gradient(135deg, rgba(239,246,255,0.98) 0%, rgba(255,247,239,0.98) 100%)',
              boxShadow: '0 18px 42px rgba(82,116,169,0.14)',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                borderRadius: 999,
                padding: '5px 10px',
                marginBottom: 8,
                background: 'rgba(82,116,169,0.12)',
                color: 'var(--color-primary)',
                fontSize: '0.78rem',
                fontWeight: 800,
              }}
            >
              AI 이미지 완성
            </span>
            <h2
              style={{
                margin: '0 0 6px',
                color: 'var(--color-text-primary)',
                fontSize: 'clamp(1.25rem, 4vw, 1.7rem)',
                letterSpacing: 0,
              }}
            >
              새 이미지가 보관함에 저장됐어요
            </h2>
            <p
              style={{
                margin: '0 0 14px',
                color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
                fontWeight: 600,
              }}
            >
              결과를 확인하고 마음에 들면 다운로드하거나, 꾸미기에서 프레임과 스티커를 더해 보세요.
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              <PrimaryButton onClick={() => navigate(`/edit/${photo.id}`)} size="md">
                꾸미기
              </PrimaryButton>
              <SecondaryButton onClick={() => navigate('/templates')} size="md">
                다시 만들기
              </SecondaryButton>
            </div>
          </section>
        )}

        {/* Photo - Polaroid style */}
        <div
          className="polaroid-card"
          style={{
            marginBottom: 0,
            padding: '12px 12px 40px 12px',
            borderRadius: '6px 6px 0 0',
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
              aspectRatio: 'auto',
              borderRadius: 3,
              background: 'var(--color-bg-soft)',
            }}
          />
        </div>

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

          {draftContent ? (
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 'var(--line-height-relaxed)',
                fontFamily: 'var(--font-family)',
                fontSize: '0.95rem',
                color: 'var(--color-text-primary)',
              }}
            >
              {draftContent}
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

        {/* Music Player */}
        {photo.music_url && (
          <>
            <audio
              ref={audioRef}
              src={resolveImageUrl(photo.music_url)}
              playsInline
              onEnded={() => setIsMusicPlaying(false)}
            />
            <section
              className="story-surface-card"
              style={{
                marginTop: 12,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <button
                onClick={() => {
                  if (!audioRef.current) return;
                  if (isMusicPlaying) {
                    audioRef.current.pause();
                    setIsMusicPlaying(false);
                  } else {
                    audioRef.current.play();
                    setIsMusicPlaying(true);
                  }
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
                  color: '#FFF8F0',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {isMusicPlaying ? '\u275A\u275A' : '\u25B6'}
              </button>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  AI 음악
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {isMusicPlaying ? '재생 중...' : '탭하여 재생'}
                </p>
              </div>
            </section>
          </>
        )}

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
                  content: draftContent || '',
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
            <span>{draftContent ? '글 수정' : '글쓰기'}</span>
          </SecondaryButton>

          <PrimaryButton
            onClick={() =>
              navigate(`/music/${photo.id}`, {
                state: {
                  topic: photo.topic,
                  imageUrl: imageUrl,
                  draftText: draftContent || '',
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

        <div style={{ marginTop: 10 }}>
          <PrimaryButton
            onClick={() => navigate(`/ai-retouch?sourcePhotoId=${photo.id}`)}
            fullWidth
            className="story-cta-with-icon"
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">✦</span>
            </span>
            <span>AI사진보정</span>
          </PrimaryButton>
        </div>

        <div style={{ marginTop: 10 }}>
          <SecondaryButton
            onClick={handleDownload}
            fullWidth
            className="story-cta-with-icon"
            disabled={isSavingImage}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x2B07;&#xFE0F;</span>
            </span>
            <span>{isSavingImage ? '저장 준비 중...' : '사진 저장'}</span>
          </SecondaryButton>
          {saveMessage && !savePreviewUrl && (
            <p
              style={{
                marginTop: 8,
                color: 'var(--color-text-secondary)',
                fontSize: '0.86rem',
                fontWeight: 650,
                textAlign: 'center',
              }}
            >
              {saveMessage}
            </p>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <SecondaryButton onClick={() => navigate('/')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3E0;</span>
            </span>
            <span>홈으로</span>
          </SecondaryButton>
        </div>
      </main>

      {savePreviewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="사진 저장 안내"
          onClick={closeSavePreview}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'grid',
            placeItems: 'center',
            padding: 18,
            background: 'rgba(21, 26, 38, 0.58)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <section
            className="story-surface-card"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(520px, 100%)',
              maxHeight: '92vh',
              display: 'grid',
              gap: 14,
              padding: 16,
              overflow: 'auto',
            }}
          >
            <div>
              <span className="story-eyebrow">사진 저장</span>
              <h2
                style={{
                  marginTop: 8,
                  color: 'var(--color-text-primary)',
                  fontSize: '1.35rem',
                  fontWeight: 950,
                  letterSpacing: 0,
                }}
              >
                사진을 길게 눌러 저장해 주세요
              </h2>
              <p
                style={{
                  marginTop: 6,
                  color: 'var(--color-text-secondary)',
                  lineHeight: 1.6,
                  fontWeight: 650,
                }}
              >
                {saveMessage || '휴대폰에서는 길게 누른 뒤 이미지 저장을 선택하면 사진첩에 저장돼요.'}
              </p>
            </div>
            <img
              src={savePreviewUrl}
              alt="저장할 사진"
              style={{
                width: '100%',
                maxHeight: '62vh',
                objectFit: 'contain',
                borderRadius: 8,
                background: 'var(--color-bg-soft)',
                WebkitTouchCallout: 'default',
                userSelect: 'auto',
              }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SecondaryButton onClick={() => window.open(savePreviewUrl, '_blank')} size="md">
                크게 열기
              </SecondaryButton>
              <PrimaryButton onClick={closeSavePreview} size="md">
                닫기
              </PrimaryButton>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
