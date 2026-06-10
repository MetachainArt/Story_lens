import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';
import sessionsService from '@/services/sessions';
import api from '@/services/api';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { inferImageMimeType, isHeicImageFile, isLikelyImageFile } from '@/utils/imageFiles';

const MAX_UPLOAD_EDGE = 2400;
const TARGET_UPLOAD_BYTES = 8 * 1024 * 1024;
const JPEG_UPLOAD_QUALITY = 0.88;

function readImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했습니다.'));
    };
    image.src = url;
  });
}

async function preparePhotoForUpload(blob: Blob): Promise<Blob> {
  if (!isLikelyImageFile(blob)) {
    return blob;
  }

  try {
    const image = await readImage(blob);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const longestEdge = Math.max(width, height);
    const scale = longestEdge > MAX_UPLOAD_EDGE ? MAX_UPLOAD_EDGE / longestEdge : 1;

    if (scale === 1 && blob.size <= TARGET_UPLOAD_BYTES && blob.type === 'image/jpeg') {
      return blob;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      return blob;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const resizedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_UPLOAD_QUALITY);
    });

    return resizedBlob || blob;
  } catch {
    if (blob instanceof File && isHeicImageFile(blob)) {
      throw new Error('unsupported-heic');
    }
    return blob instanceof File && !blob.type.startsWith('image/')
      ? new Blob([blob], { type: inferImageMimeType(blob) })
      : blob;
  }
}

function getUploadErrorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;

  if (typeof detail === 'string' && detail.trim()) {
    if (response?.status === 413 || detail.toLowerCase().includes('file too large')) {
      return '사진 용량이 너무 커요. 자동으로 줄인 뒤 다시 시도해 주세요.';
    }
    return detail;
  }

  if (response?.status === 413) {
    return '사진 용량이 너무 커요. 자동으로 줄인 뒤 다시 시도해 주세요.';
  }

  if (err instanceof Error && err.message === 'unsupported-heic') {
    return 'HEIC 사진은 브라우저에서 변환하지 못했어요. 휴대폰에서 JPG로 저장한 사진을 선택해 주세요.';
  }

  if (err instanceof Error && err.message === 'Network Error') {
    return '서버에 사진을 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return '잠시 후 다시 시도해 주세요.';
}

export default function SelectPage() {
  const navigate = useNavigate();
  const { capturedPhotos, sessionId } = useCameraStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    if (capturedPhotos.length === 0) {
      navigate('/camera', { replace: true });
    }
  }, [capturedPhotos, navigate]);

  useEffect(() => {
    const urls = capturedPhotos.map((blob) => URL.createObjectURL(blob));
    setPhotoUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [capturedPhotos]);

  useEffect(() => {
    const loadSuggestions = async () => {
      const now = new Date();
      try {
        const sessions = await sessionsService.list({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        });

        const counts = new Map<string, number>();
        for (const session of sessions) {
          for (const keyword of session.keywords || []) {
            const item = keyword.trim();
            if (!item) {
              continue;
            }
            counts.set(item, (counts.get(item) || 0) + 1);
          }
        }

        const topKeywords = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([keyword]) => keyword);

        setSuggestedTopics(topKeywords);
      } catch {
        setSuggestedTopics([]);
      }
    };

    loadSuggestions();
  }, []);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? capturedPhotos.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === capturedPhotos.length - 1 ? 0 : prev + 1));
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const diff = touchStartX.current - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrevious();
      }
    }
  };

  const persistTopic = () => {
    const topic = selectedTopic.trim();
    if (topic) {
      sessionStorage.setItem('selected_topic', topic);
    } else {
      sessionStorage.removeItem('selected_topic');
    }
  };

  const navigateWithDevPhoto = (blob: Blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      sessionStorage.setItem('dev_photo_url', String(reader.result || ''));
      navigate('/edit/dev-photo');
    };
    reader.onerror = () => {
      sessionStorage.setItem('dev_photo_url', URL.createObjectURL(blob));
      navigate('/edit/dev-photo');
    };
    reader.readAsDataURL(blob);
  };

  const handleEdit = async () => {
    if (capturedPhotos.length === 0 || isUploading) {
      return;
    }

    setUploadError('');
    persistTopic();
    const blob = capturedPhotos[currentIndex];

    const currentSessionId = sessionId;

    if (!currentSessionId || currentSessionId === 'dev-session') {
      navigateWithDevPhoto(blob);
      return;
    }

    setIsUploading(true);
    try {
      const uploadBlob = await preparePhotoForUpload(blob);
      const formData = new FormData();
      formData.append('file', uploadBlob, `capture-${Date.now()}.jpg`);
      formData.append('session_id', currentSessionId);
      const response = await api.post('/api/v1/photos', formData);
      const photoId = response.data?.id;
      if (typeof photoId === 'string' && photoId.length > 0) {
        navigate(`/edit/${photoId}`);
        return;
      }

      setUploadError('업로드 실패: 세션 ID를 받아오지 못했습니다.');
    } catch (err: unknown) {
      setUploadError(`업로드 실패: ${getUploadErrorMessage(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (capturedPhotos.length === 0) {
    return null;
  }

  return (
    <div className="story-page-shell">
      <PageHeader title="사진 선택" showBack onBack={() => navigate('/camera')} />

      <main className="story-content-container" style={{ paddingTop: 16, paddingBottom: 28 }}>
        <section className="story-surface-card" style={{ padding: 12, marginBottom: 14 }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-2xl)',
              overflow: 'hidden',
              background: 'var(--color-bg-soft)',
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={photoUrls[currentIndex]}
              alt="촬영한 사진"
              style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'contain', objectPosition: 'center', display: 'block' }}
            />

            {capturedPhotos.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  aria-label="이전"
                  className="story-cta-with-icon story-cta-secondary"
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    minHeight: 40,
                    width: 40,
                    borderRadius: '50%',
                    padding: 0,
                  }}
                >
                  <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                    <span className="story-icon-emoji">←</span>
                  </span>
                </button>

                <button
                  onClick={handleNext}
                  aria-label="다음"
                  className="story-cta-with-icon story-cta-secondary"
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    minHeight: 40,
                    width: 40,
                    borderRadius: '50%',
                    padding: 0,
                  }}
                >
                  <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                    <span className="story-icon-emoji">→</span>
                  </span>
                </button>
              </>
            )}

            <span
              style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                borderRadius: '999px',
                padding: '5px 12px',
                background: 'rgba(74, 55, 40, 0.75)',
                color: '#FFF8F0',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {currentIndex + 1} / {capturedPhotos.length}
            </span>
          </div>
        </section>

        <section className="story-surface-card" style={{ padding: 14, marginBottom: 12 }}>
          <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            제안 주제를 골라 보세요
          </p>

          {suggestedTopics.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {suggestedTopics.map((topic) => {
                const isActive = selectedTopic === topic;
                return (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => {
                      setSelectedTopic(topic);
                      setCustomTopic('');
                    }}
                    className="story-tag"
                    style={{
                      borderRadius: 'var(--radius-full)',
                      border: isActive ? '1.5px solid #C47550' : '1.5px solid var(--color-border)',
                      background: isActive ? 'rgba(212,132,90,0.18)' : 'var(--color-bg-soft)',
                      color: 'var(--color-text-primary)',
                      padding: '6px 12px',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    #{topic}
                  </button>
                );
              })}
            </div>
          )}

          <input
            aria-label="주제 입력"
            placeholder="주제 입력 (예: 공원, 놀이동산, 여행)"
            value={customTopic}
            onChange={(event) => {
              const next = event.target.value.slice(0, 30);
              setCustomTopic(next);
              setSelectedTopic(next.trim());
            }}
            className="story-field"
            style={{ height: 42, padding: '0 12px' }}
          />
        </section>

        {uploadError && (
          <p
            role="alert"
            style={{
              marginBottom: 12,
              borderRadius: 'var(--radius-xl)',
              border: '1.5px solid var(--color-error)',
              background: 'rgba(239, 68, 68, 0.12)',
              padding: '10px 12px',
              color: 'var(--color-error)',
              fontWeight: 600,
            }}
          >
            {uploadError}
          </p>
        )}

        <div className="story-action-grid">
          <PrimaryButton
            onClick={handleEdit}
            fullWidth
            isLoading={isUploading}
            disabled={isUploading}
            className="story-cta-with-icon"
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">✦</span>
            </span>
            <span>{isUploading ? '전송 중...' : '이 사진 편집하기'}</span>
          </PrimaryButton>

          <SecondaryButton onClick={() => navigate('/camera')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">+</span>
            </span>
            <span>다시 찍기</span>
          </SecondaryButton>
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
    </div>
  );
}
