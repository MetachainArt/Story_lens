import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/services/api';
import type { Category, ImageGenerationJob, ImageGenerationResponse, PromptTemplate, TemplateVariable } from '@/types/ai';
import type { Photo } from '@/types/photo';
import { resolveImageUrl } from '@/utils/storage';
import { inferImageMimeType, isHeicImageFile, isLikelyImageFile } from '@/utils/imageFiles';

type Values = Record<string, string>;
type SourceSlot = 'main' | 'extra';

const retouchJobKey = 'story_lens_active_ai_retouch_job_id';
const retouchRequestKey = 'story_lens_active_ai_retouch_request_id';
const maxPolls = 180;
const pollDelayMs = 5000;
const imageAspectRatios = ['4:3', '3:4', '1:1', '16:9', '2:3', '9:16'];
const maxSourceUploadEdge = 2400;
const sourceUploadQuality = 0.88;

const fallbackCards = [
  { name: '키 늘리기', icon: '↕', tone: 'linear-gradient(135deg, #dfeaff, #fff1e8)' },
  { name: '얼굴 뽀샤시 보정', icon: '✦', tone: 'linear-gradient(135deg, #fff5cf, #e8f4ff)' },
  { name: '얼굴 잡티 제거', icon: '○', tone: 'linear-gradient(135deg, #fff1e8, #f0eaff)' },
  { name: '회춘사진', icon: '◷', tone: 'linear-gradient(135deg, #eaf7e9, #fff1e8)' },
  { name: '가족사진 배경 바꾸기', icon: '⌂', tone: 'linear-gradient(135deg, #f0eaff, #e7f1ff)' },
  { name: '없는 사람 추가하기', icon: '+', tone: 'linear-gradient(135deg, #ffe9d8, #dff0e4)' },
  { name: '프로필 사진 보정', icon: '◎', tone: 'linear-gradient(135deg, #e8f4ff, #fff5cf)' },
  { name: '어두운 사진 밝게', icon: '☀', tone: 'linear-gradient(135deg, #fff5cf, #dfeaff)' },
  { name: '흔들린 사진 선명하게', icon: '◇', tone: 'linear-gradient(135deg, #e7f1ff, #fff1e8)' },
  { name: '오래된 사진 복원', icon: '◴', tone: 'linear-gradient(135deg, #f5eadc, #e8f4ff)' },
  { name: '색감 예쁘게 보정', icon: '◐', tone: 'linear-gradient(135deg, #ffe9d8, #f0eaff)' },
  { name: '배경 정리', icon: '□', tone: 'linear-gradient(135deg, #dff0e4, #fff5cf)' },
  { name: '표정 밝게 보정', icon: '⌣', tone: 'linear-gradient(135deg, #fff1e8, #eaf7e9)' },
  { name: '의상 주름 정리', icon: '▥', tone: 'linear-gradient(135deg, #f0eaff, #fff5cf)' },
  { name: '단체사진 얼굴 보정', icon: '◉', tone: 'linear-gradient(135deg, #e8f4ff, #dff0e4)' },
  { name: '여행사진 하늘 보정', icon: '☁', tone: 'linear-gradient(135deg, #dfeaff, #fff5cf)' },
  { name: '여름 계곡 보정', icon: '≈', tone: 'linear-gradient(135deg, #dff7ef, #dff0ff)' },
  { name: '사진관 조명 보정', icon: '◌', tone: 'linear-gradient(135deg, #fff1e8, #e7f1ff)' },
];
const retouchCardNames = new Set(fallbackCards.map((card) => card.name));

function readSourceImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image read failed'));
    };
    image.src = url;
  });
}

async function prepareSourcePhotoForUpload(file: File): Promise<Blob> {
  try {
    const image = await readSourceImage(file);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const longestEdge = Math.max(width, height);
    const scale = longestEdge > maxSourceUploadEdge ? maxSourceUploadEdge / longestEdge : 1;

    if (scale === 1 && file.size <= 8 * 1024 * 1024 && file.type === 'image/jpeg') {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const resized = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', sourceUploadQuality);
    });
    return resized || file;
  } catch {
    if (isHeicImageFile(file)) throw new Error('unsupported-heic');
    return file.type.startsWith('image/') ? file : new Blob([file], { type: inferImageMimeType(file) });
  }
}

function uploadErrorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;
  if (err instanceof Error && err.message === 'unsupported-heic') {
    return 'HEIC 사진은 JPG로 저장한 뒤 다시 올려 주세요.';
  }
  if (response?.status === 413 || (typeof detail === 'string' && detail.toLowerCase().includes('file too large'))) {
    return '사진 용량이 너무 커요. 자동으로 줄인 뒤 다시 시도해 주세요.';
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (err instanceof Error && err.message === 'Network Error') {
    return '사진을 서버로 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
  }
  return '사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.';
}

function generationMessage(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return 'AI사진보정을 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.';
  }
  if (raw.includes('KIE_API_KEY')) return '서버에 KIE_API_KEY 설정이 필요해요.';
  if (raw.includes('Kie') || raw.includes('Internal Error')) return 'Kie에서 보정을 끝내지 못했어요. 비용은 차감되지 않았을 수 있으니 잠시 뒤 다시 시도해 주세요.';
  return raw;
}

function firstValues(template: PromptTemplate | null): Values {
  if (!template) return {};
  const values: Values = {};
  template.variables.forEach((item) => {
    values[item.key] = String(template.default_values[item.key] ?? item.default_value ?? item.choices[0] ?? '');
  });
  return values;
}

function visibleVariables(template: PromptTemplate | null): TemplateVariable[] {
  if (!template) return [];
  const allowedKeys = template.visible_user_fields ?? [];
  return template.variables.filter((item) => item.choices.length > 0 && allowedKeys.includes(item.key));
}

function requiredSourceCount(template: PromptTemplate | null): number {
  const raw = template?.locale_labels?.required_source_count;
  return typeof raw === 'number' && raw > 1 ? raw : template?.name === '없는 사람 추가하기' ? 2 : 1;
}

function cardVisual(template: PromptTemplate) {
  return fallbackCards.find((item) => item.name === template.name) ?? fallbackCards[0];
}

function templatePreviewUrl(template: PromptTemplate | null): string {
  if (!template) return '';
  return resolveImageUrl(template.thumbnail_url || template.example_image_url || '');
}

function isRetouchTemplate(template: PromptTemplate, retouchCategoryIds: Set<string>) {
  const categoryKind = template.category?.kind;
  const labelKind = template.locale_labels?.kind;
  return (
    retouchCardNames.has(template.name) ||
    categoryKind === 'retouch' ||
    labelKind === 'retouch' ||
    Boolean(template.category_id && retouchCategoryIds.has(template.category_id))
  );
}

function imageFor(photo: Photo | null): string {
  if (!photo) return '';
  return resolveImageUrl(photo.edited_url || photo.thumbnail_url || photo.original_url);
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `retouch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function AiRetouchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourcePhotoIdParam = searchParams.get('sourcePhotoId');
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('4:3');
  const [sourcePhotoId, setSourcePhotoId] = useState<string | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [extraPhotoId, setExtraPhotoId] = useState<string | null>(null);
  const [extraPreviewUrl, setExtraPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<SourceSlot | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const requestIdRef = useRef<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [selectedId, templates],
  );
  const selectedVariables = useMemo(() => visibleVariables(selectedTemplate), [selectedTemplate]);
  const neededPhotos = requiredSourceCount(selectedTemplate);
  const canGenerate = Boolean(selectedTemplate && sourcePhotoId && (neededPhotos === 1 || extraPhotoId));

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryRes, templateRes] = await Promise.all([
        api.get<Category[]>('/api/v1/categories', { params: { kind: 'retouch' } }),
        api.get<PromptTemplate[]>('/api/v1/prompt-templates', { params: { kind: 'retouch' } }),
      ]);
      const retouchCategories = categoryRes.data.filter((category) => category.kind === 'retouch');
      const retouchCategoryIds = new Set(retouchCategories.map((category) => category.id));
      setCategories(retouchCategories);
      setTemplates(templateRes.data.filter((template) => isRetouchTemplate(template, retouchCategoryIds)));
      if (sourcePhotoIdParam) {
        const photoRes = await api.get<Photo>(`/api/v1/photos/${sourcePhotoIdParam}`);
        setSourcePhotoId(photoRes.data.id);
        setSourcePreviewUrl(imageFor(photoRes.data));
      }
    } catch {
      setError('AI사진보정 카드를 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [sourcePhotoIdParam]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    setValues(firstValues(selectedTemplate));
    setSelectedAspectRatio(selectedTemplate?.aspect_ratio || '4:3');
    setError(null);
    setStatusText('');
  }, [selectedTemplate]);

  useEffect(() => {
    return () => {
      [sourcePreviewUrl, extraPreviewUrl].forEach((url) => {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, [sourcePreviewUrl, extraPreviewUrl]);

  const uploadSourcePhoto = async (file: File, slot: SourceSlot) => {
    if (!isLikelyImageFile(file)) {
      setError('사진 파일을 올려 주세요.');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    if (slot === 'main') {
      setSourcePreviewUrl(previewUrl);
      setSourcePhotoId(null);
    } else {
      setExtraPreviewUrl(previewUrl);
      setExtraPhotoId(null);
    }
    setIsUploading(slot);
    setError(null);
    setStatusText('사진을 준비하고 있어요.');
    try {
      const uploadBlob = await prepareSourcePhotoForUpload(file);
      const formData = new FormData();
      formData.append('file', uploadBlob, `ai-retouch-${slot}-${Date.now()}.jpg`);
      formData.append('title', slot === 'main' ? 'AI사진보정 원본' : 'AI사진보정 추가 인물');
      formData.append('topic', 'AI사진보정');
      const res = await api.post<Photo>('/api/v1/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (slot === 'main') {
        setSourcePhotoId(res.data.id);
        setSourcePreviewUrl(resolveImageUrl(res.data.original_url) || previewUrl);
      } else {
        setExtraPhotoId(res.data.id);
        setExtraPreviewUrl(resolveImageUrl(res.data.original_url) || previewUrl);
      }
      setStatusText('사진이 준비됐어요. AI사진보정을 시작할 수 있어요.');
    } catch (err: unknown) {
      if (slot === 'main') setSourcePhotoId(null);
      else setExtraPhotoId(null);
      setError(uploadErrorMessage(err));
    } finally {
      setIsUploading(null);
    }
  };

  const finishGeneration = useCallback((job: Pick<ImageGenerationJob, 'photo_id'>) => {
    if (!job.photo_id) throw new Error('완성된 사진을 저장하지 못했어요.');
    localStorage.removeItem(retouchJobKey);
    localStorage.removeItem(retouchRequestKey);
    requestIdRef.current = null;
    setStatusText('AI사진보정이 완성됐어요. 보관함으로 이동할게요.');
    navigate(`/gallery/${job.photo_id}`, { replace: true, state: { fromAiGeneration: true, fromAiRetouch: true } });
  }, [navigate]);

  const pollJob = useCallback(async (jobId: string) => {
    localStorage.setItem(retouchJobKey, jobId);
    for (let count = 0; count < maxPolls; count += 1) {
      const res = await api.get<ImageGenerationJob>(`/api/v1/image-generations/${jobId}`);
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        finishGeneration(res.data);
        return;
      }
      if (res.data.status === 'failed') {
        localStorage.removeItem(retouchJobKey);
        throw new Error(generationMessage(res.data.error_message));
      }
      setStatusText(count < 18 ? '사진을 자연스럽게 보정하고 있어요.' : '보정이 조금 오래 걸리고 있어요. 창을 닫아도 나중에 이어서 확인할게요.');
      await new Promise((resolve) => window.setTimeout(resolve, pollDelayMs));
    }
    throw new Error('아직 보정이 끝나지 않았어요. 잠시 뒤 다시 확인해 주세요.');
  }, [finishGeneration]);

  useEffect(() => {
    const jobId = localStorage.getItem(retouchJobKey);
    if (!jobId) return;
    requestIdRef.current = localStorage.getItem(retouchRequestKey);
    submitLockRef.current = true;
    setIsGenerating(true);
    setStatusText('이전에 시작한 AI사진보정을 확인하고 있어요.');
    pollJob(jobId)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'AI사진보정 상태를 확인하지 못했어요.'))
      .finally(() => {
        setIsGenerating(false);
        submitLockRef.current = false;
      });
  }, [pollJob]);

  const generate = async () => {
    if (submitLockRef.current || isGenerating || !selectedTemplate) return;
    if (isUploading) {
      setError('사진이 아직 준비 중이에요. 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    if (!canGenerate) {
      setError(neededPhotos === 2 ? '단체사진과 추가할 사람 사진을 모두 올려 주세요.' : '보정할 사진을 먼저 올려 주세요.');
      return;
    }

    submitLockRef.current = true;
    const requestId = requestIdRef.current || localStorage.getItem(retouchRequestKey) || createRequestId();
    requestIdRef.current = requestId;
    localStorage.setItem(retouchRequestKey, requestId);
    setIsGenerating(true);
    setError(null);
    setStatusText('AI가 사진을 보정하고 있어요.');
    try {
      const sourceIds = [sourcePhotoId, extraPhotoId].filter(Boolean) as string[];
      const res = await api.post<ImageGenerationResponse>('/api/v1/image-generations', {
        template_id: selectedTemplate.id,
        variable_values: values,
        source_photo_id: sourceIds[0],
        source_photo_ids: sourceIds,
        provider_options: {
          aspect_ratio: selectedAspectRatio,
          retouch_kind: selectedTemplate.name,
          _client_request_id: requestId,
        },
      });
      localStorage.setItem(retouchJobKey, res.data.job_id);
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        finishGeneration({ photo_id: res.data.photo_id });
        return;
      }
      if (res.data.status === 'failed') {
        localStorage.removeItem(retouchJobKey);
        localStorage.removeItem(retouchRequestKey);
        requestIdRef.current = null;
        throw new Error(generationMessage(res.data.message));
      }
      await pollJob(res.data.job_id);
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
        : null;
      setError(typeof detail === 'string' ? generationMessage(detail) : err instanceof Error ? generationMessage(err.message) : generationMessage(null));
      localStorage.removeItem(retouchRequestKey);
      requestIdRef.current = null;
    } finally {
      setIsGenerating(false);
      submitLockRef.current = false;
    }
  };

  const openTemplate = (template: PromptTemplate) => {
    setSelectedId(template.id);
    setExtraPhotoId(null);
    setExtraPreviewUrl(null);
  };

  if (isLoading) {
    return (
      <main className="story-page-shell">
        <div className="story-content-container" style={{ padding: 24, fontWeight: 900 }}>AI사진보정 카드를 불러오고 있어요.</div>
      </main>
    );
  }

  return (
    <main className="story-page-shell story-page-shell--storybook ai-template-page ai-retouch-page">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <header className="story-page-header">
          <div className="story-page-header__left">
            <button className="story-page-back" type="button" onClick={() => navigate('/')} aria-label="뒤로 가기">
              <span style={{ fontSize: 24 }}>‹</span>
            </button>
          </div>
          <h1 className="story-page-title">AI사진보정</h1>
          <div className="story-page-header__right" />
        </header>

        <section className="story-hero-card ai-page-hero">
          <div>
            <span className="story-eyebrow">사진 한 장으로 새롭게</span>
            <h2>원하는 보정 카드를 고르고 사진만 올려 주세요</h2>
            <p>키 보정, 얼굴 뽀샤시, 잡티 제거, 회춘사진, 가족사진 배경 변경부터 선명도와 조명 보정까지 쉽게 만들 수 있어요.</p>
          </div>
          <div className="ai-step-list" aria-label="AI사진보정 단계">
            <span>1 카드 선택</span>
            <span>2 사진 넣기</span>
            <span>3 AI 보정</span>
            <span>4 보관함 저장</span>
          </div>
        </section>

        {!selectedTemplate ? (
          <>
            {categories.length > 0 && (
              <section className="ai-category-strip" aria-label="카테고리">
                {categories.map((category) => (
                  <span key={category.id} className="ai-category-chip ai-category-chip--active">{category.name}</span>
                ))}
              </section>
            )}
            <section className="ai-template-grid" aria-label="AI사진보정 카드 목록">
              {templates.length === 0 && (
                <div className="story-surface-card" style={{ padding: 24, fontWeight: 900, color: '#263246' }}>
                  AI사진보정 카드가 아직 서버에 반영되지 않았어요. 백엔드 배포 후 다시 열어 주세요.
                </div>
              )}
              {templates.map((template) => {
                const visual = cardVisual(template);
                const previewUrl = templatePreviewUrl(template);
                return (
                  <button type="button" key={template.id} onClick={() => openTemplate(template)} className="ai-template-card">
                    <div className="ai-template-card__image" style={{ background: visual.tone }}>
                      {previewUrl ? <img src={previewUrl} alt={`${template.name} 전후 예시`} loading="lazy" /> : <div className="ai-template-card__fallback">
                        <span>
                          <strong style={{ fontSize: 42 }}>{visual.icon}</strong>
                          <span>{requiredSourceCount(template)}장 필요</span>
                        </span>
                      </div>}
                    </div>
                    <div className="ai-template-card__body">
                      <div className="ai-template-card__badges">
                        {template.is_recommended && <span className="story-tag">추천</span>}
                        <span className="story-tag">{requiredSourceCount(template)}장</span>
                      </div>
                      <strong className="ai-template-card__title">{template.name}</strong>
                      <span className="ai-template-card__description">{template.description || '사진을 자연스럽게 AI 보정해요.'}</span>
                    </div>
                  </button>
                );
              })}
            </section>
          </>
        ) : (
          <div className="ai-workspace">
            <section className="story-surface-card ai-selected-card">
              <button type="button" onClick={() => setSelectedId(null)} className="story-quiet-button" style={{ justifySelf: 'start' }}>
                카드 다시 고르기
              </button>
              <div>
                <span className="story-eyebrow">선택한 보정</span>
                <h2 style={{ marginTop: 10, color: '#263246', fontSize: '1.55rem', fontWeight: 950 }}>{selectedTemplate.name}</h2>
                <p className="ai-helper-text" style={{ marginTop: 6 }}>{selectedTemplate.description || '사진을 자연스럽게 보정해요.'}</p>
              </div>
              <div className="ai-selected-preview" style={{ background: cardVisual(selectedTemplate).tone }}>
                {templatePreviewUrl(selectedTemplate) ? <img src={templatePreviewUrl(selectedTemplate)} alt={`${selectedTemplate.name} 전후 예시`} /> : <div className="ai-template-card__fallback">
                  <span>
                    <strong style={{ fontSize: 58 }}>{cardVisual(selectedTemplate).icon}</strong>
                    <span>{neededPhotos}장 필요</span>
                  </span>
                </div>}
              </div>
            </section>

            <aside className="story-surface-card ai-create-panel">
              <div>
                <span className="story-eyebrow">사진 넣기</span>
                <h2 style={{ marginTop: 10, color: '#263246', fontSize: '1.35rem', fontWeight: 950 }}>
                  {neededPhotos === 2 ? '단체사진과 추가할 사람 사진을 올려 주세요' : '보정할 사진을 올려 주세요'}
                </h2>
                <p className="ai-helper-text" style={{ marginTop: 4 }}>원본은 그대로 보관하고, 보정 결과는 새 사진으로 저장돼요.</p>
              </div>

              <label htmlFor="ai-retouch-main-photo" className="ai-upload-zone">
                {sourcePreviewUrl ? <img src={sourcePreviewUrl} alt="AI사진보정 원본 사진" /> : (
                  <span className="ai-upload-empty">
                    <span className="ai-upload-icon" aria-hidden="true">+</span>
                    <strong>{isUploading === 'main' ? '사진 준비 중...' : '원본 사진 선택하기'}</strong>
                    <span className="ai-helper-text">보정할 사진을 넣어 주세요.</span>
                  </span>
                )}
              </label>
              <input
                id="ai-retouch-main-photo"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={isUploading !== null || isGenerating}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) uploadSourcePhoto(file, 'main');
                  event.currentTarget.value = '';
                }}
              />

              {neededPhotos === 2 && (
                <>
                  <label htmlFor="ai-retouch-extra-photo" className="ai-upload-zone">
                    {extraPreviewUrl ? <img src={extraPreviewUrl} alt="추가할 사람 사진" /> : (
                      <span className="ai-upload-empty">
                        <span className="ai-upload-icon" aria-hidden="true">+</span>
                        <strong>{isUploading === 'extra' ? '사진 준비 중...' : '추가할 사람 사진'}</strong>
                        <span className="ai-helper-text">단체사진에 넣을 사람 사진을 올려 주세요.</span>
                      </span>
                    )}
                  </label>
                  <input
                    id="ai-retouch-extra-photo"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    disabled={isUploading !== null || isGenerating}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadSourcePhoto(file, 'extra');
                      event.currentTarget.value = '';
                    }}
                  />
                </>
              )}

              <button type="button" className="story-quiet-button" onClick={() => navigate('/gallery')} style={{ minHeight: 42 }}>
                보관함에서 사진 고르기
              </button>

              {selectedVariables.length > 0 && (
                <div style={{ display: 'grid', gap: 12 }}>
                  {selectedVariables.map((variable) => (
                    <div key={variable.key} style={{ display: 'grid', gap: 8 }}>
                      <strong style={{ color: '#344054' }}>{variable.label}</strong>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {variable.choices.map((choice) => (
                          <button
                            key={choice}
                            type="button"
                            onClick={() => setValues((prev) => ({ ...prev, [variable.key]: choice }))}
                            className={values[variable.key] === choice ? 'ai-category-chip ai-category-chip--active' : 'ai-category-chip'}
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="ai-aspect-selector">
                <strong>이미지 사이즈</strong>
                <div className="ai-aspect-grid" role="group" aria-label="AI사진보정 이미지 비율 선택">
                  {imageAspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setSelectedAspectRatio(ratio)}
                      className={selectedAspectRatio === ratio ? 'ai-aspect-button ai-aspect-button--active' : 'ai-aspect-button'}
                      aria-pressed={selectedAspectRatio === ratio}
                    >
                      <span>{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>

              {statusText && !error && <div className="ai-status ai-status--info">{statusText}</div>}
              {error && <div className="ai-status ai-status--error">{error}</div>}

              <button type="button" onClick={generate} disabled={isGenerating || isUploading !== null || !canGenerate} className="ai-submit-button">
                {isGenerating ? '보정하는 중...' : 'AI사진보정 시작'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
