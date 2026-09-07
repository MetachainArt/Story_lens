import { getUserStorage } from '@/utils/userStorage';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
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
  local_url?: string;
  image_url: string;
  title: string;
  duration: number;
  tags: string;
  lyric?: string;
};

type SavedMusic = {
  photoId: string;
  track: Track;
  style?: string;
  mood?: string;
  created_at: string;
};

const MUSIC_STYLES = [
  { key: '발라드', emoji: '&#x1F3A4;' },
  { key: '재즈', emoji: '&#x1F3B7;' },
  { key: '힙합', emoji: '&#x1F3A7;' },
  { key: '인디 팝', emoji: '&#x1F31F;' },
  { key: '로파이', emoji: '&#x1F30C;' },
  { key: '어쿠스틱 포크', emoji: '&#x1F3B8;' },
  { key: '클래식', emoji: '&#x1F3BB;' },
  { key: '시네마틱', emoji: '&#x1F3AC;' },
] as const;

const DEFAULT_STYLE = '발라드';
const MUSIC_POLL_INTERVAL_MS = 5000;
const MUSIC_MAX_WAIT_MS = 10 * 60 * 1000;

const LEGACY_MOOD_TO_STYLE: Record<string, string> = {
  잔잔한: '발라드',
  밝은: '인디 팝',
  서정적: '클래식',
  신나는: '힙합',
  몽환적: '로파이',
  따뜻한: '어쿠스틱 포크',
  그리운: '재즈',
  용감한: '시네마틱',
};

function normalizeMusicStyle(rawStyle?: string | null): string {
  if (!rawStyle) {
    return DEFAULT_STYLE;
  }

  const trimmed = rawStyle.trim();
  if (!trimmed) {
    return DEFAULT_STYLE;
  }

  const directMatch = MUSIC_STYLES.find(({ key }) => key === trimmed);
  if (directMatch) {
    return directMatch.key;
  }

  return LEGACY_MOOD_TO_STYLE[trimmed] || DEFAULT_STYLE;
}

export default function MusicPage() {
  const [userLocalStorage] = useState(() => getUserStorage());
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const location = useLocation();
  const state = location.state as MusicLocationState;

  const topic = state?.topic || '';
  const imageUrl = state?.imageUrl || null;
  const safeImageUrl = isAllowedImageUrl(imageUrl) ? imageUrl : null;
  const draftText = state?.draftText || '';

  const [selectedStyle, setSelectedStyle] = useState(DEFAULT_STYLE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [canCheckResult, setCanCheckResult] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyricsIndex, setShowLyricsIndex] = useState<number | null>(null);
  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // Load existing music for this photo
  useEffect(() => {
    if (!photoId) return;
    const saved = safeJsonArray<SavedMusic>(userLocalStorage.getItem('saved_music'));
    const existing = saved.find(
      (m): m is SavedMusic =>
        !!m && typeof m === 'object' && typeof m.photoId === 'string' && m.photoId === photoId,
    );
    if (existing?.track) {
      setTracks([existing.track]);
      setSelectedStyle(normalizeMusicStyle(existing.style ?? existing.mood));
    }
  }, [photoId, userLocalStorage]);

  const finishGeneration = useCallback(
    async (resolvedTracks: Track[]) => {
      setTracks(resolvedTracks);
      setIsGenerating(false);
      setStatusMessage('');
      setError(null);
      setCanCheckResult(false);

      const savedUrl = resolvedTracks[0]?.audio_url;
      if (photoId && savedUrl) {
        try {
          await api.put(`/api/v1/photos/${photoId}`, {
            music_url: savedUrl,
          });
        } catch {
          // Server save failed, fall back to localStorage only
        }
      }

      if (photoId) {
        const saved = safeJsonArray<SavedMusic>(userLocalStorage.getItem('saved_music'));
        const filtered = saved.filter(
          (m): m is SavedMusic =>
            !!m && typeof m === 'object' && typeof m.photoId === 'string' && m.photoId !== photoId,
        );
        const next = [
          {
            photoId,
            track: resolvedTracks[0],
            style: selectedStyle,
            mood: selectedStyle,
            created_at: new Date().toISOString(),
          },
          ...filtered,
        ];
        userLocalStorage.setItem('saved_music', JSON.stringify(next));
      }
    },
    [photoId, selectedStyle, userLocalStorage],
  );

  const checkTaskStatus = useCallback(
    async (id: string): Promise<'success' | 'pending' | 'failed'> => {
      try {
        const response = await api.get(`/api/v1/music/status/${id}`, {
          params: photoId ? { photo_id: photoId } : {},
        });
        const data = response.data;

        if (data.status === 'SUCCESS' && data.tracks?.length > 0) {
          stopPolling();
          const resolvedTracks = data.tracks.map((t: Record<string, unknown>) => ({
            ...t,
            audio_url: (t.local_url as string) || (t.audio_url as string) || '',
          }));
          await finishGeneration(resolvedTracks);
          return 'success';
        }

        if (
          data.status === 'PENDING' ||
          data.status === 'TEXT_SUCCESS' ||
          data.status === 'FIRST_SUCCESS' ||
          data.status === 'SUCCESS'
        ) {
          const progress =
            data.status === 'PENDING'
              ? '음악을 구상하고 있어요...'
              : data.status === 'TEXT_SUCCESS'
                ? '가사를 만들었어요, 멜로디 작업 중...'
                : data.status === 'FIRST_SUCCESS'
                  ? '거의 다 됐어요...'
                  : '완성된 파일을 가져오고 있어요...';
          setStatusMessage(progress);
          return 'pending';
        }

        if (
          data.status === 'CREATE_TASK_FAILED' ||
          data.status === 'GENERATE_AUDIO_FAILED' ||
          data.status === 'SENSITIVE_WORD_ERROR'
        ) {
          stopPolling();
          setIsGenerating(false);
          setCanCheckResult(false);
          setError(data.message || '음악 생성에 실패했어요. 다시 시도해 주세요.');
          return 'failed';
        }
      } catch {
        // Network error, keep polling within the wait window
      }

      return 'pending';
    },
    [finishGeneration, photoId, stopPolling],
  );

  const pollStatus = useCallback(
    (id: string) => {
      const deadline = Date.now() + MUSIC_MAX_WAIT_MS;

      const runPoll = async () => {
        const outcome = await checkTaskStatus(id);
        if (outcome !== 'pending') {
          return;
        }

        if (Date.now() >= deadline) {
          stopPolling();
          setIsGenerating(false);
          setStatusMessage('');
          setCanCheckResult(true);
          setError('생성이 오래 걸리고 있어요. 최대 10분까지 걸릴 수 있어요. 잠시 후 결과 확인을 눌러보세요.');
          return;
        }

        pollRef.current = window.setTimeout(runPoll, MUSIC_POLL_INTERVAL_MS);
      };

      void runPoll();
    },
    [checkTaskStatus, stopPolling],
  );

  const onCheckResult = useCallback(async () => {
    if (!taskId) {
      return;
    }

    setError(null);
    setCanCheckResult(false);
    setIsGenerating(true);
    setStatusMessage('완성된 음악이 있는지 다시 확인하고 있어요...');

    const outcome = await checkTaskStatus(taskId);
    if (outcome === 'pending') {
      setIsGenerating(false);
      setStatusMessage('');
      setCanCheckResult(true);
      setError('아직 생성 중이에요. 조금 더 기다린 뒤 결과 확인을 눌러보세요.');
    }
  }, [checkTaskStatus, taskId]);

  const onGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    setCanCheckResult(false);
    setTaskId(null);
    setStatusMessage('AI에게 음악을 요청하고 있어요...');
    setTracks([]);

    try {
      const response = await api.post('/api/v1/music/generate', {
        topic,
        style: selectedStyle,
        mood: selectedStyle,
        draft_text: draftText,
        photo_id: photoId || '',
      });
      const id = response.data?.task_id;
      if (!id) throw new Error('No task ID');
      setTaskId(id);
      pollStatus(id);
    } catch (error) {
      setIsGenerating(false);
      setTaskId(null);
      const detail =
        axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string'
          ? error.response.data.detail
          : null;
      setError(detail || '음악 생성 요청에 실패했어요. API 키를 확인해 주세요.');
    }
  };

  const togglePlay = (index: number) => {
    if (!audioRef.current) return;

    if (activeTrackIndex === index && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setActiveTrackIndex(index);
      // local_url > stream_url > audio_url 순서로 시도
      const t = tracks[index] as Record<string, unknown>;
      const url = (t.local_url as string) || (t.stream_url as string) || (t.audio_url as string) || '';
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {
        // CORS 차단 시 stream_url로 재시도
        if (t.stream_url && audioRef.current) {
          audioRef.current.src = t.stream_url as string;
          audioRef.current.play().catch(() => {});
        }
      });
      setIsPlaying(true);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleMusicDownload = async (track: Track) => {
    const url = track.local_url || track.audio_url || track.stream_url;
    if (!url) return;
    try {
      const response = await fetch(url, { credentials: 'include' });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${track.title || 'music'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="story-page-shell">
      <PageHeader title="음악 만들기" showBack onBack={() => navigate(-1)} />
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} playsInline />

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
                maxHeight: 360,
                objectFit: 'contain',
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

        {/* Style Selection */}
        <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
          <p style={{ marginBottom: 10, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            어떤 스타일의 음악을 만들까요?
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {MUSIC_STYLES.map(({ key, emoji }) => {
              const isActive = key === selectedStyle;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStyle(key)}
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
              최대 10분 정도 걸릴 수 있어요
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </section>
        )}

        {/* Error */}
        {error && (
          <section className="story-surface-card" style={{ marginBottom: 12, padding: 14, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 10 }}>{error}</p>
            <div className="story-action-grid">
              {canCheckResult && taskId ? (
                <SecondaryButton onClick={onCheckResult} size="md">
                  결과 확인
                </SecondaryButton>
              ) : null}
              <SecondaryButton onClick={onGenerate} size="md">
                다시 시도
              </SecondaryButton>
            </div>
          </section>
        )}

        {/* Tracks */}
        {tracks.length > 0 && (
          <section className="story-surface-card" style={{ marginBottom: 12, padding: 0, overflow: 'hidden' }}>
            {tracks.map((track, index) => (
              <div
                key={track.id || index}
                style={{
                  borderBottom: index < tracks.length - 1 ? '1px solid var(--color-border)' : 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
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

                  {/* Download + Lyrics buttons */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {track.lyric && (
                      <button
                        onClick={() => setShowLyricsIndex(showLyricsIndex === index ? null : index)}
                        title="가사 보기"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          border: '1.5px solid var(--color-border)',
                          background: showLyricsIndex === index ? 'rgba(212,132,90,0.18)' : 'var(--color-bg-soft)',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        &#x1F4DD;
                      </button>
                    )}
                    <button
                      onClick={() => handleMusicDownload(track)}
                      title="음악 다운로드"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '1.5px solid var(--color-border)',
                        background: 'var(--color-bg-soft)',
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      &#x2B07;&#xFE0F;
                    </button>
                  </div>
                </div>

                {/* Lyrics section */}
                {track.lyric && showLyricsIndex === index && (
                  <div
                    style={{
                      padding: '12px 16px',
                      borderTop: '1px solid var(--color-border)',
                      background: 'var(--color-bg-soft)',
                    }}
                  >
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: 8 }}>가사</p>
                    <pre
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-family)',
                        fontSize: '0.85rem',
                        color: 'var(--color-text-primary)',
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      {track.lyric}
                    </pre>
                  </div>
                )}
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
                setStatusMessage('');
                setCanCheckResult(false);
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
