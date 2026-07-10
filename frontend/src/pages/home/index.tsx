import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';
import mascotImg from '@/assets/illustrations/mascot.webp';
import { isLikelyImageFile } from '@/utils/imageFiles';

interface ActionCardProps {
  icon: string;
  title: string;
  copy: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  tone?: 'ai' | 'photo' | 'upload' | 'library' | 'book' | 'calendar' | 'student' | 'admin';
  badge?: string;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function ActionCard({ icon, title, copy, onClick, disabled = false, ariaLabel, tone = 'photo', badge }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`story-action-card story-action-card--${tone}`}
      aria-label={ariaLabel}
      style={{ opacity: disabled ? 0.65 : 1, cursor: disabled ? 'wait' : 'pointer' }}
    >
      {badge && <span className="story-action-card__badge">{badge}</span>}
      <span className="story-action-card__icon" aria-hidden="true">{icon}</span>
      <span>
        <span className="story-action-card__title">{title}</span>
        <span className="story-action-card__copy">{copy}</span>
      </span>
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { addPhoto, setSessionId, clearPhotos } = useCameraStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const userName = user?.name || null;
  const greeting = userName ? `${userName}님, 오늘은 어떤 이야기를 만들까요?` : '오늘은 어떤 이야기를 만들까요?';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    event.target.value = '';

    setIsUploading(true);
    clearPhotos();

    const date = todayIsoDate();
    try {
      const res = await api.post('/api/v1/sessions', { title: `업로드 ${date}`, date });
      const id = res.data?.id;
      setSessionId(typeof id === 'string' && id.length > 0 ? id : 'dev-session');
    } catch {
      setSessionId('dev-session');
    }

    for (const file of fileArray) {
      if (isLikelyImageFile(file)) {
        addPhoto(file);
      }
    }

    setIsUploading(false);
    navigate('/select');
  };

  const onLogout = async () => {
    try {
      await logout();
    } catch {
      // Keep logout navigation resilient for users.
    } finally {
      navigate('/login');
    }
  };

  return (
    <main className="story-page-shell story-page-shell--home story-page-shell--storybook">
      <div className="story-content-container story-content-container--home">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />

        <header className="story-home-topbar">
          <div className="story-home-brand">
            <span className="story-home-logo" aria-hidden="true">📷</span>
            <strong>Story Lens</strong>
          </div>
          <div className="story-home-tools">
            <button type="button" className="story-pill-button" onClick={() => navigate('/gallery')}>내 사진첩</button>
            <button type="button" className="story-icon-button" aria-label="알림">🔔</button>
            <button type="button" className="story-icon-button" aria-label="메뉴">☰</button>
          </div>
        </header>

        <section className="story-hero-card story-dashboard-hero story-dashboard-hero--storybook">
          <div className="story-dashboard-copy">
            <div className="story-dashboard-kicker-row">
              <span className="story-eyebrow">Story Lens AI</span>
              <span className="story-dashboard-chip">사진 한 장</span>
              <span className="story-dashboard-chip">카드 선택</span>
              <span className="story-dashboard-chip">바로 완성</span>
            </div>
            <div>
              <h1 className="story-dashboard-title">오늘은 어떤 이야기의 주인공이 되어볼까요?</h1>
              <p className="story-dashboard-subtitle">
                마음에 드는 카드를 고르고 사진을 올려주세요. 아이의 상상이 멋진 이미지와 이야기로 완성됩니다.
              </p>
            </div>

            <div className="story-hero-actions">
              {!isParent && (
                <>
                  <button type="button" className="story-hero-action" onClick={() => navigate('/templates')}>
                    AI 이미지 만들기
                  </button>
                  <button type="button" className="story-hero-action" onClick={() => navigate('/ai-retouch')}>
                    AI사진보정
                  </button>
                </>
              )}
              <button
                type="button"
                className="story-hero-action story-hero-action--secondary"
                onClick={() => navigate('/gallery')}
              >
                {isParent ? '모든 사진 보기' : '내 사진 보기'}
              </button>
            </div>
          </div>

          <div className="story-hero-visual story-hero-visual--storybook" aria-hidden="true">
            <div className="story-visual-moon" />
            <img src={mascotImg} alt="" />
            <span className="story-visual-spark story-visual-spark--one">✦</span>
            <span className="story-visual-spark story-visual-spark--two">★</span>
            <span className="story-visual-spark story-visual-spark--three">✧</span>
          </div>
        </section>

        {!isParent && (
          <section className="story-flow-card" aria-label="AI 이미지 생성 단계">
            {[
              ['🎁', '1 카드 고르기'],
              ['📷', '2 사진 올리기'],
              ['🪄', '3 AI 이미지 만들기'],
              ['🌟', '4 스티커로 꾸미기'],
              ['💾', '5 사진첩에 담기'],
            ].map(([icon, label], index) => (
              <div className="story-flow-step" key={label}>
                <span className="story-flow-icon" aria-hidden="true">{icon}</span>
                <strong>{label}</strong>
                {index < 4 && <span className="story-flow-arrow" aria-hidden="true">›</span>}
              </div>
            ))}
          </section>
        )}

        <section className="story-quick-panel" aria-label="주요 기능">
          {!isParent && (
            <>
              <ActionCard
                icon="🚀"
                title="AI 이미지 만들기"
                copy="카드를 고르고 인물 사진만 올리면 완성돼요."
                onClick={() => navigate('/templates')}
                ariaLabel="AI 이미지 만들기"
                tone="ai"
                badge="인기"
              />
              <ActionCard
                icon="✦"
                title="AI사진보정"
                copy="키, 얼굴, 회춘, 가족사진 배경까지 쉽게 보정해요."
                onClick={() => navigate('/ai-retouch')}
                ariaLabel="AI사진보정"
                tone="ai"
                badge="NEW"
              />
              <ActionCard
                icon="📸"
                title="사진 찍기"
                copy="카메라로 바로 촬영하고 편집해요."
                onClick={() => navigate('/camera')}
                ariaLabel="사진 촬영"
                tone="photo"
                badge="추천"
              />
              <ActionCard
                icon="🖼️"
                title={isUploading ? '업로드 중...' : '앨범에서 불러오기'}
                copy="이미 찍어둔 사진을 골라 작업해요."
                onClick={handleUploadClick}
                disabled={isUploading}
                ariaLabel="사진 업로드"
                tone="upload"
              />
            </>
          )}

          <ActionCard
            icon="📚"
            title={isParent ? '모든 사진 보기' : '내 사진 보기'}
            copy="저장된 결과물을 보고 다시 편집해요."
            onClick={() => navigate('/gallery')}
            ariaLabel="사진 보기"
            tone="library"
          />

          {!isParent && (
            <>
              <ActionCard
                icon="📖"
                title="사진집 만들기"
                copy="선택한 사진을 묶어 멋진 사진집으로 만들어요."
                onClick={() => navigate('/photobook')}
                ariaLabel="사진집 만들기"
                tone="book"
              />
              <ActionCard
                icon="🗓️"
                title="수업 일정 보기"
                copy="날짜별 활동과 사진 기록을 정리해요."
                onClick={() => navigate('/sessions')}
                ariaLabel="수업 일정 보기"
                tone="calendar"
              />
            </>
          )}

          {isTeacher && (
            <>
              <ActionCard
                icon="👧"
                title="학생 사진 보기"
                copy="학생별 사진을 확인하고 관리해요."
                onClick={() => navigate('/students')}
                ariaLabel="학생 사진 보기"
                tone="student"
              />
              {user?.can_manage_templates === true && (
                <ActionCard
                  icon="⚙️"
                  title="AI 템플릿 관리"
                  copy="생성 카드와 프롬프트를 추가하고 수정해요."
                  onClick={() => navigate('/admin/templates')}
                  ariaLabel="AI 템플릿 관리"
                  tone="admin"
                />
              )}
            </>
          )}
        </section>

        <section className="story-surface-card story-account-row">
          <div>
            <strong>{greeting}</strong>
            <p>자주 쓰는 작업을 위 카드에서 바로 시작해 보세요.</p>
          </div>
          <button type="button" onClick={onLogout} className="story-quiet-button" aria-label="로그아웃">
            로그아웃
          </button>
        </section>
      </div>
    </main>
  );
}
