import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import api from '@/services/api';
import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton, SecondaryButton } from '@/components/common/Button';
import { isAllowedImageUrl, safeJsonArray } from '@/utils/storage';
import { useSpeechInput } from '@/hooks/useSpeechInput';
import mascotImg from '@/assets/illustrations/mascot.png';
import writingImg from '@/assets/illustrations/writing.png';
import completeImg from '@/assets/illustrations/complete.png';

type WriteLocationState = {
  photoId?: string;
  topic?: string | null;
  imageUrl?: string | null;
  content?: string | null;
} | null;

type ChatMessage = {
  role: 'user' | 'ai';
  text: string;
};

const DEFAULT_TONE = '에세이';
const INITIAL_AI_MESSAGE =
  '안녕! 😊 이 사진 어떤 순간에 찍었어? 어떤 주제로 찍은 건지 얘기해줘!';

function isLocalOnlyPhotoId(photoId: string): boolean {
  return !photoId || photoId === 'draft' || photoId === 'dev-photo' || photoId.startsWith('local-');
}

async function imageUrlToBlob(imageUrl: string): Promise<Blob> {
  const response = await fetch(imageUrl, { credentials: 'include' });
  if (!response.ok) throw new Error('Failed to read image for Gemini generation.');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Image blob is not valid.');
  return blob;
}

function buildDraftFallback(topic: string, tone: string, currentText: string, keywords: string[]): string {
  const base = topic.trim() || '오늘의 순간';
  const keywordText = keywords.slice(0, 2).join(', ') || '작은 장면';
  const seed = currentText.trim();
  return [
    `${base}을 떠올리며 숨을 고르고 시작해요.`,
    `${keywordText}이(가) 기억의 문을 살짝 열어줘요.`,
    `${tone} 톤으로 오늘의 분위기를 천천히 적어봐요.`,
    seed ? `'${seed.slice(0, 24)}'의 감정을 이어가 볼게요.` : `${base}에서 느낀 감정을 한 줄 더 보태요.`,
    '끝에는 따뜻한 여운 한 줄을 남겨요.',
  ].join('\n');
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

  // Mode: 'chat' | 'write'
  const [mode, setMode] = useState<'chat' | 'write'>('chat');

  // --- Write mode state ---
  const [draft, setDraft] = useState(state?.content || '');
  const [assistantHint, setAssistantHint] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [keywordsInput, setKeywordsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [serverPhotoId, setServerPhotoId] = useState<string | null>(
    isLocalOnlyPhotoId(targetPhotoId) ? null : targetPhotoId,
  );
  const selectedTone = DEFAULT_TONE;
  const currentPhotoId = serverPhotoId || targetPhotoId;

  // --- Chat mode state ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'ai', text: INITIAL_AI_MESSAGE },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const [exchangeCount, setExchangeCount] = useState(0);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const [sttTarget, setSttTarget] = useState<'chat' | 'keywords' | 'draft'>('chat');
  const onSpeechTranscript = useCallback((text: string) => {
    if (sttTarget === 'chat') {
      setChatInput((prev) => (prev ? prev + ' ' + text : text));
    } else if (sttTarget === 'keywords') {
      setKeywordsInput((prev) => (prev ? prev + ', ' + text : text));
    } else {
      setDraft((prev) => (prev ? prev + ' ' + text : text));
    }
  }, [sttTarget]);
  const speech = useSpeechInput(onSpeechTranscript);

  const toggleStt = useCallback((target: 'chat' | 'keywords' | 'draft') => {
    setSttTarget(target);
    speech.toggle();
  }, [speech]);

  useEffect(() => {
    if (typeof chatBottomRef.current?.scrollIntoView === 'function') {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const ensureServerPhotoId = async (): Promise<string> => {
    if (!isLocalOnlyPhotoId(currentPhotoId)) return currentPhotoId;
    if (!safeImageUrl) throw new Error('No image available for Gemini upload.');
    const blob = await imageUrlToBlob(safeImageUrl);
    const extension = blob.type.split('/')[1] || 'jpeg';
    const formData = new FormData();
    formData.append('file', blob, `write-draft.${extension}`);
    if (topic) formData.append('topic', topic);
    const uploadResponse = await api.post('/api/v1/photos', formData);
    const uploadedPhotoId = uploadResponse.data?.id;
    if (typeof uploadedPhotoId !== 'string' || uploadedPhotoId.length === 0)
      throw new Error('Upload did not return a photo id.');
    setServerPhotoId(uploadedPhotoId);
    return uploadedPhotoId;
  };

  // --- Chat handlers ---
  const onSendChat = async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    const userMsg: ChatMessage = { role: 'user', text };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const photoIdForChat = await ensureServerPhotoId();
      const response = await api.post(`/api/v1/photos/${photoIdForChat}/chat-write`, {
        message: text,
        history: chatMessages,
        topic,
        exchange_count: exchangeCount,
        compile_story: false,
      });
      const reply = response.data?.reply || '좋아! 계속 얘기해줘 😊';
      setChatMessages([...newHistory, { role: 'ai', text: reply }]);
      setExchangeCount((c) => c + 1);
    } catch {
      setChatMessages([
        ...newHistory,
        { role: 'ai', text: '잠깐 생각 중이야... 다시 말해줄래? 😊' },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const onCompileChat = async () => {
    setIsCompiling(true);
    try {
      const photoIdForChat = await ensureServerPhotoId();
      const response = await api.post(`/api/v1/photos/${photoIdForChat}/chat-write`, {
        message: '',
        history: chatMessages,
        topic,
        exchange_count: exchangeCount,
        compile_story: true,
      });
      const compiled = response.data?.reply || '';
      setDraft(compiled);
      setAssistantHint('대화 내용으로 글을 완성했어요. 자유롭게 수정해 보세요 ✏️');
      setMode('write');
    } catch {
      setAssistantHint('글 완성에 실패했어요. 다시 눌러봐! 😅');
    } finally {
      setIsCompiling(false);
    }
  };

  // --- Write mode handlers ---
  const onAskAssistant = async () => {
    const keywords = keywordsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item, index, arr) => item.length > 0 && arr.indexOf(item) === index)
      .slice(0, 10);
    const fallback = buildDraftFallback(topic, selectedTone, draft, keywords);
    setIsSuggesting(true);
    try {
      const photoIdForDraft = await ensureServerPhotoId();
      const response = await api.post(`/api/v1/photos/${photoIdForDraft}/generate-draft`, {
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

  const onSaveDraft = async () => {
    const trimmed = draft.trim();
    if (!trimmed) { setAssistantHint('내용을 먼저 작성해 주세요.'); return; }
    if (currentPhotoId && !isLocalOnlyPhotoId(currentPhotoId)) {
      setIsSaving(true);
      try {
        await api.put(`/api/v1/photos/${currentPhotoId}`, { content: trimmed });
        navigate(`/gallery/${currentPhotoId}`);
        return;
      } catch {
        setAssistantHint('서버 저장에 실패했어요. 로컬에 저장합니다.');
      } finally {
        setIsSaving(false);
      }
    }
    const parsed = safeJsonArray<{
      id: string; photoId: string; topic: string; content: string; created_at: string;
    }>(localStorage.getItem('story_drafts'));
    const safeDrafts = parsed.filter(
      (item): item is { id: string; photoId: string; topic: string; content: string; created_at: string } =>
        !!item && typeof item === 'object' &&
        typeof item.id === 'string' && typeof item.photoId === 'string' &&
        typeof item.topic === 'string' && typeof item.content === 'string' &&
        typeof item.created_at === 'string',
    );
    localStorage.setItem('story_drafts', JSON.stringify([
      { id: `draft-${Date.now()}`, photoId: currentPhotoId, topic: topic || '', content: trimmed, created_at: new Date().toISOString() },
      ...safeDrafts,
    ]));
    navigate(`/gallery/${currentPhotoId}`);
  };

  // ── Tab bar ──────────────────────────────────────────────────
  const tabBar = (
    <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 'var(--radius-2xl)', overflow: 'hidden', border: '1.5px solid var(--color-border)' }}>
      {(['chat', 'write'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          style={{
            flex: 1,
            padding: '10px 0',
            border: 'none',
            background: mode === m ? 'var(--color-accent)' : 'var(--color-surface)',
            color: mode === m ? '#FFF8F0' : 'var(--color-text-secondary)',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-family)',
          }}
        >
          {m === 'chat' ? '💬 대화로 쓰기' : '✏️ 혼자 쓰기'}
        </button>
      ))}
    </div>
  );

  // ── Chat mode UI ─────────────────────────────────────────────
  const chatUI = (
    <>
      {safeImageUrl && (
        <section className="story-surface-card" style={{ marginBottom: 12, padding: 10 }}>
          <img
            src={safeImageUrl}
            alt="사진"
            style={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--radius-xl)', display: 'block' }}
          />
        </section>
      )}

      {/* Chat messages */}
      <section
        className="story-surface-card"
        style={{ padding: 14, marginBottom: 12, maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className="chat-bubble-enter"
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'ai' && (
              <img src={mascotImg} alt="AI" style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 6, flexShrink: 0, alignSelf: 'flex-end', objectFit: 'cover' }} />
            )}
            <div
              style={{
                maxWidth: '78%',
                padding: '10px 14px',
                borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)'
                  : 'var(--color-bg-soft)',
                color: msg.role === 'user' ? '#FFF8F0' : 'var(--color-text-primary)',
                fontSize: '0.93rem',
                lineHeight: 1.55,
                fontFamily: 'var(--font-family)',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              }}
            >
              {msg.text}
            </div>
            {msg.role === 'user' && (
              <span style={{ fontSize: '1.4rem', marginLeft: 6, flexShrink: 0, alignSelf: 'flex-end' }}>🙂</span>
            )}
          </div>
        ))}
        {isChatLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <img src={mascotImg} alt="AI" style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 6, objectFit: 'cover' }} />
            <div style={{ padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: 'var(--color-bg-soft)', color: 'var(--color-text-secondary)', fontSize: '0.93rem' }}>
              생각 중이야... ✨
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </section>

      {/* Chat input - hide when conversation is complete */}
      {exchangeCount < 5 && (
        <section className="story-surface-card" style={{ padding: 12, marginBottom: 10 }}>
          {speech.interimText && (
            <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              {speech.interimText}...
            </p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              aria-label="메시지 입력"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendChat(); } }}
              placeholder={speech.state === 'listening' ? '듣고 있어요...' : speech.state === 'processing' ? '변환 중...' : '얘기해봐! 😊'}
              className="story-field"
              style={{ flex: 1, height: 44, padding: '0 12px' }}
              disabled={isChatLoading || speech.state === 'processing'}
            />
            <button
              type="button"
              aria-label={speech.state === 'listening' ? '음성 입력 중지' : '음성으로 입력'}
              onClick={() => toggleStt('chat')}
              disabled={isChatLoading || speech.state === 'processing'}
              className={`stt-mic-btn${speech.state === 'listening' && sttTarget === 'chat' ? ' stt-mic-btn--active' : ''}`}
            >
              {speech.state === 'processing' && sttTarget === 'chat' ? '⏳' : speech.state === 'listening' && sttTarget === 'chat'
                ? <span className="stt-waves"><span /><span /><span /><span /></span>
                : '🎤'}
            </button>
            <PrimaryButton
              onClick={onSendChat}
              disabled={isChatLoading || !chatInput.trim()}
              size="md"
              style={{ padding: '0 16px', flexShrink: 0 }}
            >
              전송
            </PrimaryButton>
          </div>
        </section>
      )}

      {/* Compile button */}
      {exchangeCount >= 1 && (
        <PrimaryButton
          onClick={onCompileChat}
          disabled={isCompiling}
          fullWidth
          className="story-cta-with-icon"
          style={{ marginBottom: 10 }}
        >
          <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
            <span className="story-icon-emoji">📖</span>
          </span>
          <span>{isCompiling ? '글 완성 중...' : '대화로 글 완성하기'}</span>
        </PrimaryButton>
      )}
    </>
  );

  // ── Write mode UI ────────────────────────────────────────────
  const writeUI = (
    <>
      {!draft && !safeImageUrl && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img src={writingImg} alt="" style={{ width: 120, height: 120, objectFit: 'contain', margin: '0 auto', display: 'block' }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 8 }}>
            사진을 보고 떠오르는 생각을 적어봐요!
          </p>
        </div>
      )}
      {topic && (
        <section className="story-surface-card" style={{ padding: '10px 14px', marginBottom: 12 }}>
          <span style={{ display: 'inline-block', borderRadius: '999px', border: '1.5px solid rgba(196,117,80,0.35)', background: 'rgba(212,132,90,0.18)', padding: '6px 14px', fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
            주제 #{topic}
          </span>
        </section>
      )}

      {safeImageUrl && (
        <section className="story-surface-card" style={{ marginBottom: 12, padding: 10, background: 'var(--color-bg-soft)' }}>
          <img src={safeImageUrl} alt="작성 대상 이미지" style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'contain', borderRadius: 'var(--radius-xl)' }} />
        </section>
      )}

      <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
        <p style={{ marginBottom: 8, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          이 사진에서 느낀 생각을 한줄로 얘기해보세요
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            aria-label="사진에서 느낀 생각"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder={speech.state === 'listening' && sttTarget === 'keywords' ? '듣고 있어요...' : '예: 햇살이 따뜻해서 기분이 좋았어'}
            className="story-field"
            style={{ flex: 1, height: 42, padding: '0 12px' }}
          />
          <button
            type="button"
            aria-label="음성으로 입력"
            onClick={() => toggleStt('keywords')}
            disabled={speech.state === 'processing'}
            className={`stt-mic-btn${speech.state === 'listening' && sttTarget === 'keywords' ? ' stt-mic-btn--active' : ''}`}
          >
            {speech.state === 'processing' && sttTarget === 'keywords' ? '⏳' : speech.state === 'listening' && sttTarget === 'keywords'
              ? <span className="stt-waves"><span /><span /><span /><span /></span>
              : '🎤'}
          </button>
        </div>
      </section>

      <section className="story-surface-card" style={{ marginBottom: 12, padding: 14 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            aria-label="음성으로 본문 입력"
            onClick={() => toggleStt('draft')}
            disabled={speech.state === 'processing'}
            className={`stt-mic-btn${speech.state === 'listening' && sttTarget === 'draft' ? ' stt-mic-btn--active' : ''}`}
          >
            {speech.state === 'processing' && sttTarget === 'draft' ? '⏳' : speech.state === 'listening' && sttTarget === 'draft'
              ? <span className="stt-waves"><span /><span /><span /><span /></span>
              : '🎤'}
          </button>
        </div>
        {speech.interimText && sttTarget === 'draft' && (
          <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
            {speech.interimText}...
          </p>
        )}
        <textarea
          aria-label="작성 본문"
          placeholder={speech.state === 'listening' && sttTarget === 'draft' ? '말해보세요... 듣고 있어요 🎤' : '첫 문장을 써보세��.'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="story-field"
          style={{ minHeight: 200, borderRadius: 'var(--radius-2xl)', padding: '12px', fontSize: '1rem', fontFamily: 'var(--font-family)', lineHeight: 'var(--line-height-relaxed)' }}
        />
      </section>

      {assistantHint && (
        <div role="status" style={{ marginBottom: 12, borderRadius: 'var(--radius-xl)', background: 'var(--color-accent-light)', border: '1.5px solid var(--color-accent)', padding: '12px', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={completeImg} alt="" style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} />
          <span>{assistantHint}</span>
        </div>
      )}

      <div className="story-action-grid">
        <SecondaryButton onClick={onAskAssistant} disabled={isSuggesting} size="md" className="story-cta-with-icon" style={{ padding: '0 18px', cursor: isSuggesting ? 'wait' : 'pointer' }}>
          <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true"><span className="story-icon-emoji">✨</span></span>
          <span>{isSuggesting ? 'AI 글 생성 중...' : 'AI 글 생성'}</span>
        </SecondaryButton>
        <PrimaryButton onClick={onSaveDraft} disabled={isSaving} size="md" className="story-cta-with-icon" style={{ padding: '0 22px', cursor: isSaving ? 'wait' : 'pointer' }}>
          <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true"><span className="story-icon-emoji">📝</span></span>
          <span>{isSaving ? '저장 중...' : '문장 저장'}</span>
        </PrimaryButton>
      </div>
    </>
  );

  return (
    <div className="story-page-shell story-bg-warm">
      <PageHeader title="글쓰기" showBack onBack={() => navigate(-1)} />
      <main className="story-content-container" style={{ paddingTop: 16, paddingBottom: 30 }}>
        {tabBar}
        {mode === 'chat' ? chatUI : writeUI}
        <div style={{ marginTop: 16 }}>
          <SecondaryButton onClick={() => navigate('/')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true"><span className="story-icon-emoji">&#x1F3E0;</span></span>
            <span>홈으로</span>
          </SecondaryButton>
        </div>
      </main>
    </div>
  );
}
