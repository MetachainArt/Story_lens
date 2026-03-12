import { useState } from 'react';
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

const DEFAULT_TONE = '에세이';

function buildDraftFallback(topic: string, tone: string, currentText: string, keywords: string[]): string {
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
  const selectedTone = DEFAULT_TONE;

  const onAskAssistant = async () => {
    const keywords = keywordsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index)
      .slice(0, 10);
    const fallback = buildDraftFallback(topic, selectedTone, draft, keywords);

    if (!targetPhotoId || targetPhotoId === 'draft' || targetPhotoId === 'dev-photo' || targetPhotoId.startsWith('local-')) {
      setDraft(fallback);
      setAssistantHint('로컬 모드에서 보조 초안을 만들었어요. 자유롭게 수정해 보세요.');
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
        setAssistantHint('초안을 만들었어요. 자유롭게 수정해 보세요.');
      }
    } catch {
      setDraft(fallback);
      setAssistantHint('AI 요청이 불안정해서 보조 초안으로 채웠어요. 다시 눌러도 좋아요.');
    } finally {
      setIsSuggesting(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const onSaveDraft = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setAssistantHint('내용을 먼저 작성해 주세요.');
      return;
    }

    // Server photo → save via API
    if (targetPhotoId && targetPhotoId !== 'draft' && !targetPhotoId.startsWith('local-')) {
      setIsSaving(true);
      try {
        await api.put(`/api/v1/photos/${targetPhotoId}`, { content: trimmed });
        navigate(`/gallery/${targetPhotoId}`);
        return;
      } catch {
        setAssistantHint('서버 저장에 실패했어요. 로컬에 저장합니다.');
      } finally {
        setIsSaving(false);
      }
    }

    // Fallback: local photos → localStorage
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
    navigate(`/gallery/${targetPhotoId}`);
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
          <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            친구가 이 사진에서 느낀 생각을 한줄로 얘기해보세요
          </p>
          <input
            aria-label="사진에서 느낀 생각"
            value={keywordsInput}
            onChange={(event) => setKeywordsInput(event.target.value)}
            placeholder="예: 햇살이 따뜻해서 기분이 좋았어"
            className="story-field"
            style={{ height: 42, padding: '0 12px' }}
          />
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
            disabled={isSaving}
            size="md"
            className="story-cta-with-icon"
            style={{ padding: '0 22px', cursor: isSaving ? 'wait' : 'pointer' }}
          >
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">📝</span>
            </span>
            <span>{isSaving ? '저장 중...' : '문장 저장'}</span>
          </PrimaryButton>
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




