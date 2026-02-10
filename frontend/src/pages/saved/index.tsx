/**
 * Save Complete Page - Vintage Cute Style
 */
import { useNavigate, useLocation } from 'react-router-dom';
import { useEditorStore } from '@/stores/editor';

interface LocationState {
  photoId?: string;
  editedUrl?: string;
}

export default function SavedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { photoId: storePhotoId, originalUrl } = useEditorStore();

  const locationState = location.state as LocationState | null;
  const photoId = locationState?.photoId || storePhotoId;
  const imageUrl = locationState?.editedUrl || originalUrl;

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        background: 'linear-gradient(160deg, #FFF5EB 0%, #FFF0E0 50%, #FCEBD5 100%)',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {/* Success icon */}
        <div
          style={{
            width: 80,
            height: 80,
            margin: '0 auto 1.5rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #8BAA7C 0%, #7D9B6E 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(139,170,124,0.3)',
            border: '3px solid rgba(255,255,255,0.4)',
          }}
          data-testid="success-icon"
        >
          <span style={{ fontSize: '2.2rem' }}>&#x2714;&#xFE0F;</span>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-family-serif)',
            fontSize: '1.8rem',
            fontWeight: 700,
            color: 'var(--color-success)',
            marginBottom: '0.5rem',
            letterSpacing: '0.05em',
          }}
        >
          저장 완료!
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--color-text-secondary)',
            marginBottom: '1.5rem',
          }}
        >
          사진이 예쁘게 저장되었어요
        </p>

        {/* Photo preview */}
        {imageUrl && (
          <div
            style={{
              maxWidth: 360,
              margin: '0 auto 2rem',
              background: 'var(--color-surface)',
              border: '2px solid var(--color-border)',
              borderRadius: 'var(--radius-2xl)',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <img
              src={imageUrl}
              alt="저장된 사진"
              style={{
                width: '100%',
                maxHeight: '50vh',
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320, margin: '0 auto' }}>
          <button
            onClick={() => navigate('/')}
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
            홈으로 돌아가기
          </button>

          {photoId && (
            <button
              onClick={() => navigate(`/edit/${photoId}`)}
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
              다시 편집하기
            </button>
          )}
        </div>

        {/* Footer deco */}
        <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--color-text-light)', fontFamily: 'var(--font-family-serif)', letterSpacing: '0.15em' }}>
          &#x2661; Story Lens &#x2661;
        </p>
      </div>
    </main>
  );
}
