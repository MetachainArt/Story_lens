import { useNavigate, useLocation } from 'react-router-dom';
import { useEditorStore } from '@/stores/editor';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';

interface LocationState {
  photoId?: string;
  editedUrl?: string;
  topic?: string;
}

export default function SavedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { photoId: storePhotoId, originalUrl } = useEditorStore();

  const locationState = location.state as LocationState | null;
  const photoId = locationState?.photoId || storePhotoId;
  const imageUrl = locationState?.editedUrl || originalUrl;
  const topic = locationState?.topic || null;

  return (
    <main className="story-page-shell" style={{ minHeight: '100vh', padding: '24px 0' }}>
      <div className="story-content-container" style={{ maxWidth: 520 }}>
        <section className="story-surface-card" style={{ textAlign: 'center', padding: '22px 16px' }}>
          <div className="story-icon-3d story-icon-3d-primary" style={{
            margin: '0 auto 14px',
            width: 82,
            height: 82,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(139,170,124,0.3)',
            border: '3px solid rgba(255,255,255,0.4)',
          }}>
            <span className="story-icon-emoji" style={{ fontSize: '2.2rem' }}>✓</span>
          </div>

          <h1
            style={{
              marginBottom: 6,
              fontFamily: 'var(--font-family-serif)',
              fontSize: '1.9rem',
              fontWeight: 700,
              color: 'var(--color-success)',
            }}
          >
            완료!
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16 }}>편집이 모두 끝났어요.</p>

          {imageUrl && (
            <div
              style={{
                margin: '0 auto 14px',
                maxWidth: 380,
                borderRadius: 'var(--radius-2xl)',
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface)',
                boxShadow: 'var(--shadow-md)',
                overflow: 'hidden',
              }}
            >
              <img
                src={imageUrl}
                alt="편집 사진"
                className="rounded-lg"
                style={{
                  width: '100%',
                  maxHeight: '45dvh',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {topic && (
            <div style={{ marginBottom: 14 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(212,132,90,0.16)',
                  border: '1.5px solid rgba(196,117,80,0.35)',
                  color: 'var(--color-text-primary)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                <span>주제</span>
                <span>#{topic}</span>
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gap: 10, maxWidth: 340, margin: '0 auto' }}>
            <PrimaryButton
              onClick={() => navigate('/')}
              fullWidth
              className="story-cta-with-icon"
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">🏠</span>
              </span>
              <span>홈으로</span>
            </PrimaryButton>

            <SecondaryButton
              onClick={() => navigate(`/edit/${photoId}`)}
              fullWidth
              disabled={!photoId}
              className="story-cta-with-icon"
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">✎</span>
              </span>
              <span>다시 편집</span>
            </SecondaryButton>

            <button
              onClick={() =>
                navigate(`/write/${photoId || 'draft'}`, {
                  state: { photoId, topic, imageUrl },
                })
              }
              className="story-cta-primary story-cta-with-icon"
              style={{
                width: '100%',
                minHeight: 'var(--button-height-md)',
              }}
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">📝</span>
              </span>
              <span>글로 이어쓰기</span>
            </button>
          </div>

          <p
            style={{
              marginTop: '1.5rem',
              fontSize: '0.8rem',
              color: 'var(--color-text-light)',
              fontFamily: 'var(--font-family-serif)',
              letterSpacing: '0.14em',
            }}
          >
            Story Lens with you
          </p>
        </section>
      </div>
    </main>
  );
}
