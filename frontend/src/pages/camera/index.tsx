/**
 * Camera Page - Vintage Cute Style
 * Controls overlay on top of camera preview (no black bar)
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';

export default function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { capturedPhotos, setSessionId, addPhoto } = useCameraStore();

  const [status, setStatus] = useState('');
  const [isReady, setIsReady] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsReady(false);
    setStatus('카메라 연결 중...');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          setStatus('');
          setIsReady(true);
          setSessionId('dev-session');
        }).catch(() => {
          setStatus('재생 실패');
        });
      };
    } catch (err: any) {
      setStatus(`카메라를 열 수 없어요: ${err.message}`);
    }
  }, [setSessionId]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  const handleFlipCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) addPhoto(blob); }, 'image/jpeg', 0.9);
  }, [addPhoto]);

  const handleFinish = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    navigate('/select');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#1A1410' }}>
      {/* Full-screen camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* Vintage vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(26,20,16,0.3) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Flash */}
      {flashEffect && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,248,240,0.7)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Status message */}
      {status && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255,248,240,0.95)',
            color: 'var(--color-text-primary)',
            padding: '16px 28px',
            borderRadius: 'var(--radius-xl)',
            fontSize: '1rem',
            fontFamily: 'var(--font-family)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 20,
            textAlign: 'center',
            border: '1.5px solid var(--color-border)',
          }}
        >
          {status}
        </div>
      )}

      {/* Top bar - overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,248,240,0.15)',
            borderRadius: 'var(--radius-full)',
            color: '#FFF8F0',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-family)',
          }}
        >
          &#x2190; 홈
        </button>

        {capturedPhotos.length > 0 && (
          <div
            style={{
              background: 'rgba(212,132,90,0.85)',
              backdropFilter: 'blur(8px)',
              color: '#FFF8F0',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.9rem',
              fontWeight: 600,
              fontFamily: 'var(--font-family)',
            }}
          >
            {capturedPhotos.length}장
          </div>
        )}
      </div>

      {/* Bottom controls - overlay (transparent background) */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '20px 0',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          zIndex: 10,
        }}
      >
        {/* Left: Finish */}
        <div style={{ width: 56, textAlign: 'center' }}>
          {capturedPhotos.length > 0 ? (
            <button
              onClick={handleFinish}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(212,132,90,0.85)',
                backdropFilter: 'blur(8px)',
                border: '2px solid rgba(255,248,240,0.3)',
                color: '#FFF8F0',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-family)',
                fontWeight: 600,
              }}
            >
              완료<br/>{capturedPhotos.length}장
            </button>
          ) : (
            <div style={{ width: 56 }} />
          )}
        </div>

        {/* Center: Capture */}
        <button
          onClick={handleCapture}
          disabled={!isReady}
          aria-label="촬영"
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            border: '4px solid rgba(255,248,240,0.8)',
            background: isReady
              ? 'radial-gradient(circle, rgba(255,248,240,0.9) 0%, rgba(234,217,200,0.8) 100%)'
              : 'rgba(255,248,240,0.2)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            boxShadow: isReady ? '0 0 20px rgba(255,248,240,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
          onMouseDown={e => { if (isReady) e.currentTarget.style.transform = 'scale(0.9)'; }}
          onMouseUp={e => { if (isReady) e.currentTarget.style.transform = 'scale(1)'; }}
          onTouchStart={e => { if (isReady) e.currentTarget.style.transform = 'scale(0.9)'; }}
          onTouchEnd={e => { if (isReady) e.currentTarget.style.transform = 'scale(1)'; }}
        />

        {/* Right: Flip */}
        <div style={{ width: 56, textAlign: 'center' }}>
          <button
            onClick={handleFlipCamera}
            aria-label="카메라 전환"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              border: '1.5px solid rgba(255,248,240,0.2)',
              color: '#FFF8F0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
            }}
          >
            &#x1F504;
          </button>
        </div>
      </div>
    </div>
  );
}
