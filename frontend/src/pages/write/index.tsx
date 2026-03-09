import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '@/services/api';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { isAllowedImageUrl, safeJsonArray } from '@/utils/storage';

type WriteLocationState = {
  photoId?: string;
  topic?: string | null;
  imageUrl?: string | null;
} | null;

const WRITING_TONES = ['에세이', '동화', '소설', '시', '일기', '편지', '여행기', '인터뷰'] as const;
type WritingTone = (typeof WRITING_TONES)[number];

function buildSuggestion(topic: string, currentText: string): string {
  const normalized = topic.trim() || '여행';
  if (!currentText.trim()) {
    return `${normalized} 이야기로 아이디어를 시작해서 특별한 추억을 글로 담아보세요.`;
  }
  return `좋은 흐름입니다. ${normalized}를 주제로 조금 더 감성을 담아 확장해 보세요.`;
}

function buildDraftFallback(topic: string, tone: WritingTone, currentText: string, keywords: string[]): string {
  const base = topic.trim() || '오늘의 순간';
  const keywordText = keywords.slice(0, 2).join(', ') || '작은 장면';
  const seed = currentText.trim();
  const lines = [
    `${base}을 떠올리며 숨을 고르고 시작해요.`,
    `${keywordText}이(가) 기억의 문을 살짝 열어줘요.`,
    `${tone} 톤으로 오늘의 분위기를 천천히 적어봐요.`,
    seed ? `'${seed.slice(0, 24)}'의 감정을 이어가 볼게요.` : `${base}에서 느낀 감정을 한 줄 더 보태요.`,
    '끝에는 따뜻한 여운 한 줄을 남겨요.',
  ];
  return lines.slice(0, 5).join('\n');
}

export default function WritePage() {
  const navigate = useNavigate();
  const { photoId } = useParams<{ photoId: string }>();
  const location = useLocation();
  const state = location.state as WriteLocationState;

  const topic = (state?.topic || sessionStorage.getItem('selected_topic') || '').trim();
  const imageUrl = state?.imageUrl || null;
  const safeImageUrl = isAllowedImageUrl(imageUrl) ? imageUrl : null;
  const targetPhotoId = state?.photoId || photoId || 'draft';

  const [draft, setDraft] = useState('');
  const [assistantHint, setAssistantHint] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [selectedTone, setSelectedTone] = useState<WritingTone>('에세이');

  const suggestedOpeners = useMemo(() => {
    const base = topic || '주제';
    return [
      `${base}의 추억을 떠올리며, 오늘의 하이라이트를 기록해요.`,
      `${base}에서 느꼈던 감정과 장면을 생생하게 적어보세요.`,
      `${base} 덕분에 남는 순간을 간단하게 정리해보세요.`,
    ];
  }, [topic]);

  const onPickOpener = (line: string) => {
    setDraft((prev) => (prev ? `${prev}\n${line}` : line));
  };

  const onAskAssistant = async () => {
    const keywords = keywordsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index)
      .slice(0, 10);
    const fallback = buildDraftFallback(topic, selectedTone, draft, keywords);

    if (!targetPhotoId || targetPhotoId === 'draft' || targetPhotoId === 'dev-photo' || targetPhotoId.startsWith('local-')) {
      setDraft(fallback);
      setAssistantHint('로컬 글 생성으로 보여드려요. 서버 사진에서는 AI가 작동해요.');
      return;
    }

    setIsSuggesting(true);
    try {
      const response = await api.post(`/api/v1/photos/${targetPhotoId}/generate-draft`, {
        topic,
        keywords,
        tone: selectedTone,
        current_text: draft,
      });
      const generatedDraft = response.data?.draft;
      if (typeof generatedDraft === 'string' && generatedDraft.trim()) {
        setDraft(generatedDraft.trim());
        const source = response.data?.source === 'gemini' ? 'Gemini' : '보조 생성기';
        setAssistantHint(`${source}로 최대 5줄 초안을 만들었어요. 마음에 드는 부분을 이어 써보세요.`);
      } else {
        setDraft(fallback);
        setAssistantHint(buildSuggestion(topic, draft));
      }
    } catch {
      setDraft(fallback);
      setAssistantHint('AI 요청이 불안정해서 보조 초안으로 채웠어요. 다시 눌러도 좋아요.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const onSaveDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAssistantHint('내용을 먼저 작성해 주세요.');
      return;
    }

    const parsed = safeJsonArray<{
      id: string;
      photoId: string;
      topic: string;
      content: string;
      created_at: string;
    }>(localStorage.getItem('story_drafts'));

    const safeDrafts = parsed.filter(
      (item): item is { id: string; photoId: string; topic: string; content: string; created_at: string } =>
        !!item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.photoId === 'string' &&
        typeof item.topic === 'string' &&
        typeof item.content === 'string' &&
        typeof item.created_at === 'string',
    );

    const nextDrafts = [
      {
        id: `draft-${Date.now()}`,
        photoId: targetPhotoId,
        topic: topic || '',
        content: trimmed,
        created_at: new Date().toISOString(),
      },
      ...safeDrafts,
    ];

    localStorage.setItem('story_drafts', JSON.stringify(nextDrafts));
    navigate('/');
  };
  return (
    <div className="story-page-shell">
      <PageHeader title="글쓰기 시작" showBack onBack={() => navigate(-1)} />
      <main className="story-content-container" style={{ paddingTop: 16, paddingBottom: 30 }}>
        <section className="story-surface-card" style={{ padding: 16, marginBottom: 12 }}>
          <h1
            style={{
              marginBottom: 8,
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family-serif)',
              fontSize: 'var(--font-size-h2)',
            }}
          >
            AI와 함께 글쓰기
          </h1>

          <p style={{ marginBottom: 10, color: 'var(--color-text-secondary)' }}>
            사진 주제에 따라 더 좋은 글이 만들어지도록 도움을 받아보세요.
          </p>

          {topic && (
            <p
              style={{
                marginBottom: 0,
                display: 'inline-block',
                borderRadius: '999px',
                border: '1.5px solid rgba(196,117,80,0.35)',
                background: 'rgba(212,132,90,0.18)',
                padding: '8px 14px',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
              }}
            >
              주제 #{topic}
            </p>
          )}
        </section>

        {safeImageUrl && (
          <section
            className="story-surface-card"
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 'var(--radius-2xl)',
              background: 'var(--color-bg-soft)',
            }}
          >
            <img
              src={safeImageUrl}
              alt="작성 대상 이미지"
              style={{
                width: '100%',
                display: 'block',
                maxHeight: 280,
                objectFit: 'contain',
                objectPosition: 'center',
                borderRadius: 'var(--radius-xl)',
              }}
            />
          </section>
        )}

        <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
          <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>시작 문장 추천</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {suggestedOpeners.map((line) => (
              <button
                key={line}
                onClick={() => onPickOpener(line)}
                className="story-cta-secondary story-cta-with-icon"
                style={{
                  textAlign: 'left',
                  borderRadius: 'var(--radius-xl)',
                  background: 'var(--color-bg-soft)',
                  color: 'var(--color-text-primary)',
                  minHeight: 48,
                  padding: '10px 12px',
                  cursor: 'pointer',
                }}
              >
                <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                  <span className="story-icon-emoji">✦</span>
                </span>
                <span>{line}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
          <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>키워드와 톤</p>
          <input
            aria-label="키워드 입력"
            value={keywordsInput}
            onChange={(event) => setKeywordsInput(event.target.value)}
            placeholder="키워드 입력 (예: 바다, 햇살, 웃음)"
            className="story-field"
            style={{ height: 42, padding: '0 12px', marginBottom: 10 }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            {WRITING_TONES.map((tone) => {
              const isActive = tone === selectedTone;
              return (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setSelectedTone(tone)}
                  className="story-tag"
                  style={{
                    minHeight: 38,
                    borderRadius: 'var(--radius-xl)',
                    border: isActive ? '1.5px solid #C47550' : '1.5px solid var(--color-border)',
                    background: isActive ? 'rgba(212,132,90,0.18)' : 'var(--color-bg-soft)',
                    color: 'var(--color-text-primary)',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  {tone}
                </button>
              );
            })}
          </div>
        </section>

        <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
          <textarea
            aria-label="작성 본문"
            placeholder="첫 문장을 써보세요."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="story-field"
            style={{
              minHeight: 220,
              borderRadius: 'var(--radius-2xl)',
              padding: '12px',
              fontSize: '1rem',
              fontFamily: 'var(--font-family)',
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 12,
            }}
          />
        </section>

        {assistantHint && (
          <p
            role="status"
            style={{
              marginBottom: 12,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-accent-light)',
              border: '1.5px solid var(--color-accent)',
              padding: '10px',
              color: 'var(--color-text-primary)',
            }}
          >
            {assistantHint}
          </p>
        )}

        <div className="story-action-grid">
          <SecondaryButton
            onClick={onAskAssistant}
            disabled={isSuggesting}
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 18px', cursor: isSuggesting ? 'wait' : 'pointer' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">✨</span>
            </span>
            <span>{isSuggesting ? 'AI 글 생성 중...' : 'AI 글 생성'}</span>
          </SecondaryButton>

          <PrimaryButton
            onClick={onSaveDraft}
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 22px' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">📝</span>
            </span>
            <span>문장 저장</span>
          </PrimaryButton>
        </div>
      </main>
    </div>
  );
}




