import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';
import api from '@/services/api';
import { isLikelyImageFile } from '@/utils/imageFiles';

type CameraFacing = 'environment' | 'user';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'unknown';
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { capturedPhotos, setSessionId, addPhoto } = useCameraStore();

  const [status, setStatus] = useState('카메라 준비중...');
  const [isReady, setIsReady] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [facingMode, setFacingMode] = useState<CameraFacing>('environment');

  useEffect(() => {
    const createSession = async () => {
      const date = todayIsoDate();
      try {
        const response = await api.post('/api/v1/sessions', {
          title: `촬영 ${date}`,
          date,
        });
        const id = response.data?.id;
        if (typeof id === 'string' && id.length > 0) {
          setSessionId(id);
          return;
        }
      } catch {
        // fallback below
      }

      setSessionId('dev-session');
    };

    createSession();
  }, [setSessionId]);

  const startCamera = useCallback(async (facing: CameraFacing) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setIsReady(false);
    setIsPermissionDenied(false);
    setStatus('카메라 준비중...');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        return;
      }

      video.srcObject = stream;
      setStatus('');
      setIsReady(true);
      video.onloadedmetadata = () => {
        video.play().catch(() => {
          // ignore play rejection in test/browser edge cases
        });
      };
    } catch (error: unknown) {
      setStatus(`카메라 접근 실패 (${getErrorMessage(error)})`);
      setIsPermissionDenied(true);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void startCamera(facingMode);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode, startCamera]);

  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 180);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          addPhoto(blob);
        }
      },
      'image/jpeg',
      0.9
    );
  }, [addPhoto]);

  const handleFinish = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    navigate('/select');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportPhotos = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    for (const file of Array.from(files)) {
      if (isLikelyImageFile(file)) {
        addPhoto(file);
      }
    }

    event.target.value = '';
    navigate('/select');
  };

  return (
    <main className="story-page-shell camera-page-shell">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="카메라 미리보기"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 35%, rgba(20,14,10,0.46) 100%)',
          pointerEvents: 'none',
        }}
      />

      {flashEffect && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,248,240,0.64)',
            pointerEvents: 'none',
          }}
        />
      )}

      <div className="camera-controls">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/')}
            className="story-cta-secondary story-cta-with-icon"
            style={{
              minHeight: 40,
              padding: '0 12px',
              borderStyle: 'solid',
              borderColor: 'rgba(255, 248, 240, 0.4)',
              background: 'rgba(35, 24, 16, 0.56)',
              color: '#FFF8F0',
            }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">←</span>
            </span>
            <span>홈</span>
          </button>

          <span
            style={{
              borderRadius: '999px',
              padding: '6px 14px',
              background: 'rgba(35, 24, 16, 0.56)',
              border: '1px solid rgba(255, 248, 240, 0.25)',
              color: '#FFF8F0',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {capturedPhotos.length}장
          </span>
        </div>

        <div className="camera-shell-footer">
          {status && (
            <div
              role="status"
              style={{
                marginBottom: 14,
                borderRadius: 'var(--radius-xl)',
                padding: '12px 14px',
                background: 'rgba(255, 248, 240, 0.94)',
                border: '1.5px solid var(--color-border)',
                textAlign: 'center',
                color: 'var(--color-text-primary)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {status}
            </div>
          )}

          {isPermissionDenied && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <button
                onClick={() => navigate('/')}
                className="story-cta-primary story-cta-with-icon"
                style={{ minHeight: 44, padding: '0 16px' }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">!</span>
                </span>
                <span>권한 재요청</span>
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 18,
              paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImportPhotos}
              style={{ display: 'none' }}
            />

            {capturedPhotos.length > 0 ? (
              <button
                onClick={handleFinish}
                className="story-cta-secondary story-cta-with-icon"
                style={{ minHeight: 46, padding: '0 14px', background: 'rgba(255,248,240,0.92)' }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">✓</span>
                </span>
                <span>다음</span>
              </button>
            ) : (
              <button
                onClick={handleImportClick}
                className="story-cta-secondary story-cta-with-icon"
                style={{ minHeight: 46, padding: '0 14px', background: 'rgba(255,248,240,0.92)' }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">⤴</span>
                </span>
                <span>불러오기</span>
              </button>
            )}

            <button
              onClick={handleCapture}
              disabled={!isReady}
              aria-label="촬영"
              className="camera-lens-btn"
              style={{
                width: 76,
                height: 76,
                cursor: isReady ? 'pointer' : 'not-allowed',
                background: isReady
                  ? 'radial-gradient(circle, rgba(255,248,240,0.95) 0%, rgba(234,217,200,0.8) 100%)'
                  : 'rgba(255,248,240,0.3)',
                boxShadow: isReady ? '0 0 22px rgba(255,248,240,0.36)' : 'none',
              }}
            />

            <button
              onClick={handleFlipCamera}
              aria-label="카메라 전환"
              className="story-cta-secondary story-cta-with-icon"
              style={{ minHeight: 46, padding: '0 14px', background: 'rgba(255,248,240,0.92)' }}
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">⇄</span>
              </span>
              <span>전환</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
