/**
 * Home Page - Vintage Cute Style
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useCameraStore } from '@/stores/camera'
import api from '@/services/api'
import mascotImg from '@/assets/illustrations/mascot.png'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { addPhoto, setSessionId, clearPhotos } = useCameraStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const userName = user?.name || null
  const greeting = userName
    ? `반갑습니다 ${userName}님`
    : '반갑습니다'

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const fileArray = Array.from(files)
    e.target.value = ''

    setIsUploading(true)
    clearPhotos()

    // Create a session for the upload
    const date = todayIsoDate()
    try {
      const res = await api.post('/api/v1/sessions', { title: `업로드 ${date}`, date })
      const id = res.data?.id
      if (typeof id === 'string' && id.length > 0) {
        setSessionId(id)
      } else {
        setSessionId('dev-session')
      }
    } catch {
      setSessionId('dev-session')
    }

    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        addPhoto(file)
      }
    }

    setIsUploading(false)
    navigate('/select')
  }

  const onLogout = async () => {
    try {
      await logout()
    } catch {
      // ignore logout failure and continue navigation
    } finally {
      navigate('/login')
    }
  }

  return (
    <main className="story-page-shell story-page-shell--home">
      <div className="story-content-container story-content-container--home">
        <section className="story-hero-card">
          <div className="story-hero-head">
            <img src={mascotImg} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: 'var(--shadow-cute)' }} />

            <div>
              <h2 className="story-hero-title" style={{ fontFamily: 'var(--font-family)', fontSize: '1.4rem', fontWeight: 800 }}>꿈꾸는 카메라</h2>
              <p className="story-hero-subtitle">✦ 오늘의 이야기를 담다, 편집하고 쓰고 만들다 ✦</p>
            </div>
          </div>
          <p className="story-hero-copy">
            여행과 추억 기록, 아이디어 기록을 한 번에 정리하고 글쓰기까지 만들어보세요.
          </p>
        </section>

        <section className="story-surface-card story-hero-greeting">
          <h2 style={{ fontSize: '1.05rem', marginBottom: 4 }}>{greeting}</h2>
          <p className="story-hero-greet">사진이 떠오른 순간을 가장 먼저 기록해요</p>
        </section>

        {/* Hidden file input for gallery upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />

        <div className="story-action-grid">
          <button
            onClick={() => navigate('/camera')}
            className="story-cta-primary story-cta-with-icon"
            style={{
              width: '100%',
              minHeight: 'var(--button-height-lg)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-button)',
              fontWeight: 700,
            }}
            aria-label="사진 촬영"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-soft" aria-hidden="true">
              <span className="story-icon-emoji">📸</span>
            </span>
            <span>사진 찍기</span>
          </button>

          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="story-cta-primary story-cta-with-icon"
            style={{
              width: '100%',
              minHeight: 'var(--button-height-lg)',
              cursor: isUploading ? 'wait' : 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-button)',
              fontWeight: 700,
              opacity: isUploading ? 0.7 : 1,
            }}
            aria-label="사진 업로드"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-soft" aria-hidden="true">
              <span className="story-icon-emoji">📤</span>
            </span>
            <span>{isUploading ? '업로드 중...' : '앨범에서 불러오기'}</span>
          </button>

          <button
            onClick={() => navigate('/gallery')}
            className="story-cta-secondary story-cta-with-icon"
            style={{
              width: '100%',
              minHeight: 'var(--button-height-md)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
            }}
            aria-label="내 사진 보기"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-warm" aria-hidden="true">
              <span className="story-icon-emoji">🖼️</span>
            </span>
            <span>내 사진 보기</span>
          </button>

          <button
            onClick={() => navigate('/photobook')}
            className="story-cta-secondary story-cta-with-icon"
            style={{
              width: '100%',
              minHeight: 'var(--button-height-md)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
            }}
            aria-label="사진집 만들기"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-warm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F4D6;</span>
            </span>
            <span>사진집 만들기</span>
          </button>

          <button
            onClick={() => navigate('/sessions')}
            className="story-cta-secondary story-cta-with-icon"
            style={{
              width: '100%',
              minHeight: 'var(--button-height-md)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
            }}
            aria-label="월별 일정 보기"
          >
            <span className="story-icon-3d story-icon-3d-sm story-icon-3d-warm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F5D3;&#xFE0F;</span>
            </span>
            <span>월별 일정 보기</span>
          </button>

          {user?.role === 'teacher' && (
            <button
              onClick={() => navigate('/students')}
              className="story-cta-secondary story-cta-with-icon"
              style={{
                width: '100%',
                minHeight: 'var(--button-height-md)',
                cursor: 'pointer',
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                background: 'linear-gradient(135deg, #E8D5C4 0%, #F0D5B8 100%)',
                border: '1.5px solid var(--color-primary)',
              }}
              aria-label="학생 사진 보기"
            >
              <span className="story-icon-3d story-icon-3d-sm story-icon-3d-warm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F9D1;&#x200D;&#x1F393;</span>
              </span>
              <span>학생 사진 보기</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="story-cta-secondary"
            style={{
              width: '100%',
              minHeight: 'var(--touch-target-min)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
            }}
            aria-label="로그아웃"
          >
            로그아웃
          </button>
        </div>

        <p className="story-footer-note">♥ 아이들의 추억을 기록해요 ♥</p>
      </div>
    </main>
  )
}
