import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

type WriteLocationState = {
  photoId?: string;
  topic?: string | null;
  imageUrl?: string | null;
} | null;

function buildSuggestion(topic: string, currentText: string): string {
  const normalized = topic.trim() || '오늘의 순간';
  if (!currentText.trim()) {
    return `${normalized}을(를) 떠올리며 오늘 찍은 장면을 한 문장으로 시작해볼까요?`;
  }
  return `좋아요! ${normalized} 느낌이 더 보이도록 인물의 표정과 소리를 한 줄 더 적어봐요.`;
}

export default function WritePage() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const location = useLocation();
  const state = location.state as WriteLocationState;

  const topic = (state?.topic || sessionStorage.getItem('selected_topic') || '').trim();
  const imageUrl = state?.imageUrl || null;
  const targetPhotoId = state?.photoId || photoId || 'draft';

  const [draft, setDraft] = useState('');
  const [assistantHint, setAssistantHint] = useState('');

  const suggestedOpeners = useMemo(() => {
    const base = topic || '이 순간';
    return [
      `${base}을(를) 보자마자 내 마음이 환해졌다.`,
      `오늘의 ${base}은(는) 나에게 특별한 용기를 줬다.`,
      `${base} 속에서 우리는 함께 웃으며 이야기를 만들었다.`,
    ];
  }, [topic]);

  const onPickOpener = (line: string) => {
    setDraft((prev) => (prev ? `${prev}\n${line}` : line));
  };

  const onAskAssistant = () => {
    setAssistantHint(buildSuggestion(topic, draft));
  };

  const onSaveDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAssistantHint('한 줄 이상 작성하면 저장할 수 있어요.');
      return;
    }

    const raw = localStorage.getItem('story_drafts') || '[]';
    const parsed = JSON.parse(raw) as Array<{
      id: string;
      photoId: string;
      topic: string;
      content: string;
      created_at: string;
    }>;

    parsed.unshift({
      id: `draft-${Date.now()}`,
      photoId: targetPhotoId,
      topic,
      content: trimmed,
      created_at: new Date().toISOString(),
    });

    localStorage.setItem('story_drafts', JSON.stringify(parsed));
    navigate('/');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '20px 16px 30px',
        background: 'linear-gradient(160deg, #FFF5EB 0%, #FCEBD5 100%)',
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginBottom: 10,
            border: 'none',
            background: 'none',
            color: 'var(--color-text-primary)',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          ← 이전으로
        </button>

        <h1
          style={{
            marginBottom: 6,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family-serif)',
            fontSize: '1.6rem',
          }}
        >
          AI와 이야기 쓰기
        </h1>

        <p style={{ marginBottom: 14, color: 'var(--color-text-secondary)' }}>
          사진 주제를 바탕으로 한 문장씩 이야기를 완성해요.
        </p>

        {topic && (
          <p
            style={{
              marginBottom: 12,
              display: 'inline-block',
              borderRadius: '999px',
              border: '1.5px solid rgba(196,117,80,0.35)',
              background: 'rgba(212,132,90,0.18)',
              padding: '6px 12px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
            }}
          >
            주제 #{topic}
          </p>
        )}

        {imageUrl && (
          <div
            style={{
              marginBottom: 14,
              borderRadius: 'var(--radius-2xl)',
              overflow: 'hidden',
              border: '2px solid var(--color-border)',
              maxWidth: 420,
              background: 'var(--color-surface)',
            }}
          >
            <img
              src={imageUrl}
              alt="글쓰기 대상 사진"
              style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }}
            />
          </div>
        )}

        <section
          style={{
            marginBottom: 12,
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            padding: '14px',
          }}
        >
          <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>시작 문장 추천</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {suggestedOpeners.map((line) => (
              <button
                key={line}
                onClick={() => onPickOpener(line)}
                style={{
                  textAlign: 'left',
                  border: '1.5px dashed var(--color-border)',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--color-bg-soft)',
                  color: 'var(--color-text-primary)',
                  padding: '9px 10px',
                  cursor: 'pointer',
                }}
              >
                {line}
              </button>
            ))}
          </div>
        </section>

        <textarea
          aria-label="스토리 초안"
          placeholder="아이와 나눈 대화를 한 문장씩 적어보세요"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: 220,
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid var(--color-border)',
            padding: '12px',
            fontSize: '1rem',
            fontFamily: 'var(--font-family)',
            marginBottom: 12,
          }}
        />

        {assistantHint && (
          <p
            role="status"
            style={{
              marginBottom: 12,
              borderRadius: 'var(--radius-xl)',
              background: '#F7ECE0',
              border: '1.5px solid #E8C8A8',
              padding: '10px',
              color: '#5A3F2B',
            }}
          >
            {assistantHint}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onAskAssistant}
            style={{
              height: 46,
              padding: '0 18px',
              borderRadius: 'var(--radius-2xl)',
              border: '1.5px dashed var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text-primary)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            AI 문장 제안
          </button>

          <button
            onClick={onSaveDraft}
            style={{
              height: 46,
              padding: '0 22px',
              borderRadius: 'var(--radius-2xl)',
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'linear-gradient(135deg, #8BAA7C 0%, #7D9B6E 100%)',
              color: '#FFF8F0',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            초안 저장
          </button>
        </div>
      </div>
    </main>
  );
}
