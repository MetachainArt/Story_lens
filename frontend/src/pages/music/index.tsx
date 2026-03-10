import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { isAllowedImageUrl, safeJsonArray } from '@/utils/storage';
import api from '@/services/api';

type MusicLocationState = {
  topic?: string | null;
  imageUrl?: string | null;
  draftText?: string | null;
} | null;

type Track = {
  id: string;
  audio_url: string;
  stream_url: string;
  image_url: string;
  title: string;
  duration: number;
  tags: string;
};

type SavedMusic = {
  photoId: string;
  track: Track;
  mood: string;
  created_at: string;
};

const MOODS = [
  { key: '잔잔한', emoji: '&#x1F33F;' },
  { key: '밝은', emoji: '&#x2600;&#xFE0F;' },
  { key: '서정적', emoji: '&#x1F3B5;' },
  { key: '신나는', emoji: '&#x1F525;' },
  { key: '몽환적', emoji: '&#x2728;' },
  { key: '따뜻한', emoji: '&#x2615;' },
  { key: '그리운', emoji: '&#x1F319;' },
  { key: '용감한', emoji: '&#x1F3AF;' },
] as const;

export default function MusicPage() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const location = useLocation();
  const state = location.state as MusicLocationState;

  const topic = state?.topic || '';
  const imageUrl = state?.imageUrl || null;
  const safeImageUrl = isAllowedImageUrl(imageUrl) ? imageUrl : null;
  const draftText = state?.draftText || '';

  const [selectedMood, setSelectedMood] = useState('잔잔한');
  const [isGenerating, setIsGenerating] = useState(false);
  const [, setTaskId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Load existing music for this photo
  useEffect(() => {
    if (!photoId) return;
    const saved = safeJsonArray<SavedMusic>(localStorage.getItem('saved_music'));
    const existing = saved.find(
      (m): m is SavedMusic =>
        !!m && typeof m === 'object' && typeof m.photoId === 'string' && m.photoId === photoId,
    );
    if (existing?.track) {
      setTracks([existing.track]);
      setSelectedMood(existing.mood || '잔잔한');
    }
  }, [photoId]);

  const pollStatus = useCallback(
    (id: string) => {
      let attempts = 0;
      const maxAttempts = 60; // ~2 minutes

      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
          stopPolling();
          setIsGenerating(false);
          setError('시간이 너무 오래 걸려요. 나중에 다시 시도해 주세요.');
          return;
        }

        try {
          const response = await api.get(`/api/v1/music/status/${id}`);
          const data = response.data;

          if (data.status === 'SUCCESS' && data.tracks?.length > 0) {
            stopPolling();
            setTracks(data.tracks);
            setIsGenerating(false);
            setStatusMessage('');

            // Save music_url to server (for cross-device playback)
            if (photoId && data.tracks[0]?.audio_url) {
              try {
                await api.put(`/api/v1/photos/${photoId}`, {
                  music_url: data.tracks[0].audio_url,
                });
              } catch {
                // Server save failed, fall back to localStorage only
              }
            }

            // Save to localStorage as backup
            if (photoId) {
              const saved = safeJsonArray<SavedMusic>(localStorage.getItem('saved_music'));
              const filtered = saved.filter(
                (m): m is SavedMusic =>
                  !!m && typeof m === 'object' && typeof m.photoId === 'string' && m.photoId !== photoId,
              );
              const next = [
                {
                  photoId,
                  track: data.tracks[0],
                  mood: selectedMood,
                  created_at: new Date().toISOString(),
                },
                ...filtered,
              ];
              localStorage.setItem('saved_music', JSON.stringify(next));
            }
          } else if (data.status === 'PENDING' || data.status === 'TEXT_SUCCESS' || data.status === 'FIRST_SUCCESS') {
            const progress =
              data.status === 'PENDING'
                ? '음악을 구상하고 있어요...'
                : data.status === 'TEXT_SUCCESS'
                  ? '가사를 만들었어요, 멜로디 작업 중...'
                  : '거의 다 됐어요...';
            setStatusMessage(progress);
          } else if (
            data.status === 'CREATE_TASK_FAILED' ||
            data.status === 'GENERATE_AUDIO_FAILED' ||
            data.status === 'SENSITIVE_WORD_ERROR'
          ) {
            stopPolling();
            setIsGenerating(false);
            setError(data.message || '음악 생성에 실패했어요. 다시 시도해 주세요.');
          }
        } catch {
          // Network error, keep polling
        }
      }, 2000);
    },
    [stopPolling, photoId, selectedMood],
  );

  const onGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    setStatusMessage('AI에게 음악을 요청하고 있어요...');
    setTracks([]);

    try {
      const response = await api.post('/api/v1/music/generate', {
        topic,
        mood: selectedMood,
        draft_text: draftText,
      });
      const id = response.data?.task_id;
      if (!id) throw new Error('No task ID');
      setTaskId(id);
      pollStatus(id);
    } catch {
      setIsGenerating(false);
      setError('음악 생성 요청에 실패했어요. API 키를 확인해 주세요.');
    }
  };

  const togglePlay = (index: number) => {
    if (!audioRef.current) return;

    if (activeTrackIndex === index && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setActiveTrackIndex(index);
      audioRef.current.src = tracks[index].audio_url;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="story-page-shell">
      <PageHeader title="음악 만들기" showBack onBack={() => navigate(-1)} />
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      <main className="story-content-container" style={{ paddingBottom: 30 }}>
        {/* Photo + Topic */}
        {safeImageUrl && (
          <section
            className="story-surface-card"
            style={{ marginBottom: 12, padding: 12, overflow: 'hidden' }}
          >
            <img
              src={safeImageUrl}
              alt="사진"
              style={{
                width: '100%',
                display: 'block',
                maxHeight: 200,
                objectFit: 'cover',
                borderRadius: 'var(--radius-xl)',
              }}
            />
            {topic && (
              <p
                style={{
                  marginTop: 10,
                  display: 'inline-block',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(196,117,80,0.35)',
                  background: 'rgba(212,132,90,0.18)',
                  padding: '5px 12px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'var(--color-text-primary)',
                }}
              >
                #{topic}
              </p>
            )}
          </section>
        )}

        {/* Mood Selection */}
        <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
          <p style={{ marginBottom: 10, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            어떤 분위기의 음악을 만들까요?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {MOODS.map(({ key, emoji }) => {
              const isActive = key === selectedMood;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedMood(key)}
                  className="story-tag"
                  style={{
                    minHeight: 50,
                    borderRadius: 'var(--radius-xl)',
                    border: isActive ? '1.5px solid #C47550' : '1.5px solid var(--color-border)',
                    background: isActive ? 'rgba(212,132,90,0.18)' : 'var(--color-bg-soft)',
                    color: 'var(--color-text-primary)',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    fontSize: '0.8rem',
                  }}
                >
                  <span dangerouslySetInnerHTML={{ __html: emoji }} style={{ fontSize: '1.2rem' }} />
                  <span>{key}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Generate Button */}
        {tracks.length === 0 && (
          <div style={{ marginBottom: 12 }}>
            <PrimaryButton
              onClick={onGenerate}
              disabled={isGenerating}
              size="lg"
              className="story-cta-with-icon"
              style={{ width: '100%', cursor: isGenerating ? 'wait' : 'pointer' }}
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F3B6;</span>
              </span>
              <span>{isGenerating ? 'AI가 작곡 중...' : 'AI 음악 만들기'}</span>
            </PrimaryButton>
          </div>
        )}

        {/* Progress */}
        {isGenerating && statusMessage && (
          <section
            className="story-surface-card"
            style={{
              marginBottom: 12,
              padding: 20,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                margin: '0 auto 12px',
                border: '4px solid var(--color-border)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <p style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{statusMessage}</p>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem', marginTop: 4 }}>
              약 20~30초 정도 걸려요
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </section>
        )}

        {/* Error */}
        {error && (
          <section className="story-surface-card" style={{ marginBottom: 12, padding: 14, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 10 }}>{error}</p>
            <SecondaryButton onClick={onGenerate} size="md">
              다시 시도
            </SecondaryButton>
          </section>
        )}

        {/* Tracks */}
        {tracks.length > 0 && (
          <section className="story-surface-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {tracks.map((track, index) => (
              <div
                key={track.id || index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  borderBottom: index < tracks.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                {/* Play Button */}
                <button
                  onClick={() => togglePlay(index)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
                    color: '#FFF8F0',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {activeTrackIndex === index && isPlaying ? '\u275A\u275A' : '\u25B6'}
                </button>

                {/* Track Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontSize: '0.9rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {track.title || `Track ${index + 1}`}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                    {track.duration ? formatDuration(track.duration) : ''} {track.tags ? `\u00B7 ${track.tags}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Actions after generation */}
        {tracks.length > 0 && (
          <div className="story-action-grid">
            <SecondaryButton
              onClick={() => {
                setTracks([]);
                setTaskId(null);
                setError(null);
              }}
              size="md"
              className="story-cta-with-icon"
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F504;</span>
              </span>
              <span>다시 만들기</span>
            </SecondaryButton>

            <PrimaryButton
              onClick={() => navigate(`/gallery/${photoId}`)}
              size="md"
              className="story-cta-with-icon"
            >
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x2705;</span>
              </span>
              <span>완료</span>
            </PrimaryButton>
          </div>
        )}
      </main>
    </div>
  );
}
