import { useRef, useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';
import mascotImg from '@/assets/illustrations/mascot.png';

interface ActionCardProps {
  icon: string;
  title: string;
  copy: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  tone?: 'ai' | 'photo' | 'upload' | 'library' | 'book' | 'calendar' | 'student' | 'admin';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function ActionCard({ icon, title, copy, onClick, disabled = false, ariaLabel, tone = 'photo' }: ActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`story-action-card story-action-card--${tone}`}
      aria-label={ariaLabel}
      style={{ opacity: disabled ? 0.65 : 1, cursor: disabled ? 'wait' : 'pointer' }}
    >
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
  const greeting = userName ? `${userName}님, 오늘은 어떤 장면을 만들까요?` : '오늘은 어떤 장면을 만들까요?';
  const isParent = user?.role === 'parent';
  const isTeacher = user?.role === 'teacher';

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';

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
      if (file.type.startsWith('image/')) {
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
    <main className="story-page-shell story-page-shell--home">
      <div className="story-content-container story-content-container--home">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />

        <section className="story-hero-card story-dashboard-hero">
          <div className="story-dashboard-copy">
            <div className="story-dashboard-kicker-row">
              <span className="story-eyebrow">Story Lens</span>
              <span className="story-dashboard-chip">AI 이미지</span>
              <span className="story-dashboard-chip">사진 편집</span>
            </div>
            <div>
              <h1 className="story-dashboard-title">사진 한 장으로 새로운 이야기를 만들어요</h1>
              <p className="story-dashboard-subtitle">
                AI 이미지, 사진 편집, 보관함까지 한 화면에서 바로 시작할 수 있어요.
                어려운 설정은 줄이고 필요한 버튼만 크게 정리했습니다.
              </p>
            </div>

            <div className="story-hero-actions">
              {!isParent && (
                <button type="button" className="story-hero-action" onClick={() => navigate('/templates')}>
                  AI 이미지 만들기
                </button>
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

          <div className="story-hero-visual story-hero-visual--3d" aria-hidden="true">
            <div className="story-visual-stack">
              <div className="story-visual-card story-visual-card--back">
                <span>동화풍</span>
              </div>
              <div className="story-visual-card story-visual-card--middle">
                <span>포토카드</span>
              </div>
              <div className="story-visual-card story-visual-card--front">
                <img src={mascotImg} alt="" />
                <strong>AI 이미지 카드</strong>
                <span>사진을 넣으면 바로 완성</span>
              </div>
            </div>
            <div className="story-visual-toolbar">
              <span>4:3</span>
              <span>16:9</span>
              <span>3:4</span>
            </div>
          </div>
        </section>

        <section className="story-surface-card story-account-row">
          <div>
            <strong style={{ color: '#263246', fontSize: '1.05rem' }}>{greeting}</strong>
            <p>자주 쓰는 작업을 아래 카드에서 바로 시작하세요.</p>
          </div>
          <button type="button" onClick={onLogout} className="story-quiet-button" aria-label="로그아웃">
            로그아웃
          </button>
        </section>

        <section className="story-quick-panel" aria-label="주요 기능">
          {!isParent && (
            <>
              <ActionCard
                icon="AI"
                title="AI 이미지 만들기"
                copy="카드 선택 후 인물 사진만 올리면 완성돼요."
                onClick={() => navigate('/templates')}
                ariaLabel="AI 이미지 만들기"
                tone="ai"
              />
              <ActionCard
                icon="＋"
                title="사진 찍기"
                copy="카메라로 바로 촬영하고 편집해요."
                onClick={() => navigate('/camera')}
                ariaLabel="사진 촬영"
                tone="photo"
              />
              <ActionCard
                icon="↑"
                title={isUploading ? '업로드 중...' : '앨범에서 불러오기'}
                copy="이미 찍어둔 사진을 골라 이어서 작업해요."
                onClick={handleUploadClick}
                disabled={isUploading}
                ariaLabel="사진 업로드"
                tone="upload"
              />
            </>
          )}

          <ActionCard
            icon="▣"
            title={isParent ? '모든 사진 보기' : '내 사진 보기'}
            copy="저장된 결과물을 크게 보고 다시 편집해요."
            onClick={() => navigate('/gallery')}
            ariaLabel="사진 보기"
            tone="library"
          />

          {!isParent && (
            <>
              <ActionCard
                icon="▤"
                title="사진집 만들기"
                copy="선택한 사진을 묶어 출력용 사진집으로 만들어요."
                onClick={() => navigate('/photobook')}
                ariaLabel="사진집 만들기"
                tone="book"
              />
              <ActionCard
                icon="□"
                title="월별 일정 보기"
                copy="날짜별 활동과 사진 기록을 정리해요."
                onClick={() => navigate('/sessions')}
                ariaLabel="월별 일정 보기"
                tone="calendar"
              />
            </>
          )}

          {isTeacher && (
            <>
              <ActionCard
                icon="ST"
                title="학생 사진 보기"
                copy="학생별 사진을 확인하고 관리해요."
                onClick={() => navigate('/students')}
                ariaLabel="학생 사진 보기"
                tone="student"
              />
              <ActionCard
                icon="⚙"
                title="AI 템플릿 관리"
                copy="park.js 계정에서 생성 카드를 추가하고 수정해요."
                onClick={() => navigate('/admin/templates')}
                ariaLabel="AI 템플릿 관리"
                tone="admin"
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
