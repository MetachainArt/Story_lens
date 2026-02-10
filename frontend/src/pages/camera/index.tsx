/**
 * Camera Page - Vintage Cute Style
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
    // Stop existing stream
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsReady(false);
    setStatus('카메라 연결 중...');

    try {
      // Try requested facing mode first
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback: any camera
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
    <div style={{ position: 'fixed', inset: 0, background: '#1A1410', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div
        style={{
          padding: '10px 16px',
          background: 'linear-gradient(180deg, rgba(26,20,16,0.9) 0%, transparent 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'rgba(255,248,240,0.15)',
            border: '1px solid rgba(255,248,240,0.2)',
            borderRadius: 'var(--radius-full)',
            color: '#FFF8F0',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-family)',
          }}
        >
          &#x2190; 홈으로
        </button>

        {capturedPhotos.length > 0 && (
          <div
            style={{
              background: 'rgba(212,132,90,0.9)',
              color: '#FFF8F0',
              padding: '6px 16px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.9rem',
              fontWeight: 600,
              fontFamily: 'var(--font-family)',
              boxShadow: '0 2px 12px rgba(212,132,90,0.4)',
            }}
          >
            {capturedPhotos.length}장 촬영
          </div>
        )}
      </div>

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

      {/* Camera preview */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
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
      </div>

      {/* Bottom controls */}
      <div
        style={{
          flexShrink: 0,
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          background: 'linear-gradient(180deg, transparent 0%, rgba(26,20,16,0.95) 30%)',
          paddingTop: 32,
        }}
      >
        {/* Left: Finish or camera flip */}
        <div style={{ width: 56, textAlign: 'center' }}>
          {capturedPhotos.length > 0 ? (
            <button
              onClick={handleFinish}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(212,132,90,0.9)',
                border: '2px solid rgba(255,248,240,0.3)',
                color: '#FFF8F0',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontFamily: 'var(--font-family)',
                fontWeight: 600,
                boxShadow: '0 2px 12px rgba(212,132,90,0.4)',
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
              ? 'radial-gradient(circle, #FFF8F0 0%, #EAD9C8 100%)'
              : 'rgba(255,248,240,0.2)',
            cursor: isReady ? 'pointer' : 'not-allowed',
            boxShadow: isReady ? '0 0 20px rgba(255,248,240,0.3)' : 'none',
            transition: 'all 0.2s',
          }}
          onMouseDown={e => { if (isReady) e.currentTarget.style.transform = 'scale(0.9)'; }}
          onMouseUp={e => { if (isReady) e.currentTarget.style.transform = 'scale(1)'; }}
        />

        {/* Right: Flip camera */}
        <div style={{ width: 56, textAlign: 'center' }}>
          <button
            onClick={handleFlipCamera}
            aria-label="카메라 전환"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255,248,240,0.15)',
              border: '1.5px solid rgba(255,248,240,0.3)',
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
