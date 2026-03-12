/**
 * @TASK P3-S2-T1 - Camera Page Implementation
 * @SPEC Camera page with WebRTC viewfinder and capture functionality
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCameraStore } from '@/stores/camera';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import type { CreateSessionResponse } from '@/types/session';

export default function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { sessionId, capturedPhotos, setSessionId, addPhoto } = useCameraStore();
  const { isAuthenticated } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Initialize camera and create session
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let mounted = true;

    const initializeCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Create session
        const today = new Date().toISOString().split('T')[0];
        const response = await api.post<CreateSessionResponse>('/api/sessions', {
          title: `촬영 ${today}`,
          date: today,
        });

        if (mounted) {
          setSessionId(response.data.id);
          setIsCameraReady(true);
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (mounted) {
          setError(err.message || '카메라 접근에 실패했습니다.');
          setIsLoading(false);
        }
      }
    };

    initializeCamera();

    // Cleanup
    return () => {
      mounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isAuthenticated, navigate, setSessionId]);

  // Capture photo
  const handleCapture = () => {
    if (!videoRef.current || !isCameraReady) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to Blob
    canvas.toBlob((blob) => {
      if (blob) {
        addPhoto(blob);
      }
    }, 'image/jpeg', 0.95);
  };

  // Finish capturing and navigate to select screen
  const handleFinish = () => {
    if (capturedPhotos.length === 0) return;

    // Stop camera stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Navigate to select screen
    navigate('/select', { state: { sessionId } });
  };

  // Go back to home
  const handleGoHome = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    navigate('/home');
  };

  // Loading state
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div
          className="w-16 h-16 border-4 rounded-full animate-spin mb-4"
          style={{
            borderColor: 'var(--color-primary)',
            borderTopColor: 'transparent',
          }}
        />
        <p
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text-primary)' }}
        >
          카메라 준비 중...
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        <div
          className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
          style={{ backgroundColor: 'var(--color-error-bg)' }}
        >
          <svg
            className="w-12 h-12"
            style={{ color: 'var(--color-error)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2
          className="text-2xl font-bold mb-2 text-center"
          style={{ color: 'var(--color-text-primary)' }}
        >
          카메라 접근 권한이 필요합니다
        </h2>
        <p
          className="text-center mb-8"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {error}
        </p>
        <button
          onClick={handleGoHome}
          className="px-8 py-4 rounded-lg font-semibold text-white transition-all"
          style={{
            backgroundColor: 'var(--color-primary)',
            minHeight: 'var(--touch-target-recommended)',
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  // Camera view
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#000000' }}
    >
      {/* Video viewfinder */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Photo counter overlay */}
        <div className="absolute top-6 left-0 right-0 flex justify-center">
          <div
            className="px-6 py-3 rounded-full backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
            }}
          >
            <p className="text-white text-lg font-semibold">
              {capturedPhotos.length}장 촬영됨
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        className="p-8 flex flex-col items-center gap-6"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      >
        {/* Finish button (shown when photos exist) */}
        {capturedPhotos.length > 0 && (
          <button
            onClick={handleFinish}
            className="px-8 py-4 rounded-lg font-semibold transition-all"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#FFFFFF',
              minHeight: 'var(--button-height-lg)',
              fontSize: 'var(--font-size-button)',
            }}
          >
            찍기 끝 ({capturedPhotos.length}장)
          </button>
        )}

        {/* Capture button */}
        <button
          onClick={handleCapture}
          disabled={!isCameraReady}
          className="relative transition-all"
          style={{
            width: 'var(--touch-target-recommended)',
            height: 'var(--touch-target-recommended)',
          }}
          aria-label="촬영"
        >
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-4 border-white"
            style={{
              opacity: isCameraReady ? 1 : 0.5,
            }}
          />
          {/* Inner button */}
          <div
            className="absolute inset-2 rounded-full transition-all"
            style={{
              backgroundColor: isCameraReady ? '#FFFFFF' : '#999999',
            }}
          />
        </button>
      </div>
    </div>
  );
}
