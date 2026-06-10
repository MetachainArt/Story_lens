import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { Category, ImageGenerationJob, ImageGenerationResponse, PromptTemplate, TemplateVariable } from '@/types/ai';
import type { Photo } from '@/types/photo';
import { resolveImageUrl } from '@/utils/storage';
import { inferImageMimeType, isHeicImageFile, isLikelyImageFile } from '@/utils/imageFiles';

type Values = Record<string, string>;
type CompletedResult = {
  photoId: string;
  resultUrl: string;
};

const safetyError = '이 주제는 사용할 수 없어요. 다른 예쁜 주제로 바꿔볼까요?';
const generationError = '이미지를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.';
const activeGenerationJobKey = 'story_lens_active_ai_generation_job_id';
const maxGenerationPolls = 180;
const generationPollDelayMs = 5000;
const imageAspectRatios = ['4:3', '16:9', '3:2', '2:3', '3:4', '9:16'];
const maxSourceUploadEdge = 2400;
const sourceUploadQuality = 0.88;

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
    if (isHeicImageFile(file)) {
      throw new Error('unsupported-heic');
    }
    return file.type.startsWith('image/') ? file : new Blob([file], { type: inferImageMimeType(file) });
  }
}

function sourceUploadMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { detail?: unknown } } }).response;
  const detail = response?.data?.detail;

  if (err instanceof Error && err.message === 'unsupported-heic') {
    return 'HEIC 사진은 브라우저에서 변환하지 못했어요. 휴대폰에서 JPG로 저장한 사진을 선택해 주세요.';
  }

  if (response?.status === 413 || (typeof detail === 'string' && detail.toLowerCase().includes('file too large'))) {
    return '사진 용량이 너무 커요. 자동으로 줄인 뒤 다시 시도해 주세요.';
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (err instanceof Error && err.message === 'Network Error') {
    return '사진을 서버에 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
  }

  return '사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.';
}

function generationMessage(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    return generationError;
  }
  if (raw.includes('KIE_API_KEY')) {
    return '이미지 생성 API 키가 아직 설정되지 않았어요. 서버에 KIE_API_KEY를 넣고 다시 시작해 주세요.';
  }
  if (raw.includes('OPENAI_API_KEY')) {
    return 'OpenAI 이미지 API 키가 아직 설정되지 않았어요. 서버 설정을 확인해 주세요.';
  }
  if (raw.includes('PUBLIC_API_URL') || raw.includes('로컬 주소') || raw.includes('localhost') || raw.includes('127.0.0.1')) {
    return '로컬 주소라 AI가 업로드 사진을 읽을 수 없어요. 운영 서버에서 테스트하거나 PUBLIC_API_URL을 외부 HTTPS 주소로 설정해 주세요.';
  }
  if (raw.includes('OpenAI reference-image generation')) {
    return 'OpenAI 전환은 아직 인물 사진 참조 생성을 지원하지 않아요. Kie.ai로 설정해 주세요.';
  }
  if (raw.includes('Internal Error') || raw.includes('Please try again later')) {
    return 'Kie에서 잠깐 이미지를 만들지 못했어요. 비용은 차감되지 않았으니 잠시 뒤 다시 눌러 주세요.';
  }
  if (raw === safetyError) {
    return safetyError;
  }
  return raw;
}

function firstValues(template: PromptTemplate | null): Values {
  if (!template) return {};
  const values: Values = {};
  template.variables.forEach((item) => {
    values[item.key] = String(
      template.default_values[item.key] ??
      item.default_value ??
      item.choices[0] ??
      ''
    );
  });
  return values;
}

function swatchFor(template: PromptTemplate) {
  const palettes = [
    'linear-gradient(135deg, #dfeaff 0%, #fff1e8 100%)',
    'linear-gradient(135deg, #ffe9d8 0%, #dff0e4 100%)',
    'linear-gradient(135deg, #f0eaff 0%, #e7f1ff 100%)',
    'linear-gradient(135deg, #fff5cf 0%, #dfeaff 100%)',
  ];
  return palettes[template.name.length % palettes.length];
}

function imageFor(template: PromptTemplate) {
  return resolveImageUrl(template.thumbnail_url || template.example_image_url || '');
}

function visibleVariables(template: PromptTemplate | null): TemplateVariable[] {
  if (!template) return [];
  const allowedKeys = template.visible_user_fields ?? [];
  if (allowedKeys.length === 0) return [];
  return template.variables.filter((item) => (
    item.key !== 'subject' &&
    item.choices.length > 0 &&
    allowedKeys.includes(item.key)
  ));
}

function initialAspectRatio(template: PromptTemplate | null): string {
  if (template?.aspect_ratio && imageAspectRatios.includes(template.aspect_ratio)) {
    return template.aspect_ratio;
  }
  return '4:3';
}

function aspectShapeStyle(ratio: string) {
  const [width, height] = ratio.split(':').map((value) => Number(value));
  if (!width || !height) {
    return { width: 42, height: 28 };
  }
  const maxWidth = 58;
  const maxHeight = 34;
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categoryId, setCategoryId] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Values>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sourcePhotoId, setSourcePhotoId] = useState<string | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [isUploadingSource, setIsUploadingSource] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('4:3');
  const [completedResult, setCompletedResult] = useState<CompletedResult | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const generationSubmitLockRef = useRef(false);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [selectedId, templates]
  );

  const filteredTemplates = useMemo(() => {
    if (categoryId === 'all') return templates;
    return templates.filter((item) => item.category_id === categoryId);
  }, [categoryId, templates]);

  const selectedVariables = useMemo(() => visibleVariables(selectedTemplate), [selectedTemplate]);
  const acceptsTextOption = selectedTemplate?.visible_user_fields.includes('text_option') ?? false;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [categoryRes, templateRes] = await Promise.all([
        api.get<Category[]>('/api/v1/categories', { params: { kind: 'template' } }),
        api.get<PromptTemplate[]>('/api/v1/prompt-templates'),
      ]);
      setCategories(categoryRes.data);
      setTemplates(templateRes.data);
      setSelectedId(null);
      setValues({});
    } catch {
      setError('템플릿을 불러오지 못했어요. 잠시 뒤 다시 열어주세요.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setValues(firstValues(selectedTemplate));
    setSelectedAspectRatio(initialAspectRatio(selectedTemplate));
  }, [selectedTemplate]);

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(sourcePreviewUrl);
      }
    };
  }, [sourcePreviewUrl]);

  const openTemplate = (template: PromptTemplate) => {
    setSelectedId(template.id);
    setValues(firstValues(template));
    setError(null);
    setStatusText('');
    setSourcePhotoId(null);
    setSourcePreviewUrl(null);
    setCompletedResult(null);
    setSelectedAspectRatio(initialAspectRatio(template));
  };

  const uploadSourcePhoto = async (file: File) => {
    if (!isLikelyImageFile(file)) {
      setError('인물 사진 파일을 넣어 주세요.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(previewUrl);
    setSourcePhotoId(null);
    setIsUploadingSource(true);
    setError(null);
    setStatusText('사진을 서버에 올리는 중이에요. 잠시만 기다려 주세요.');
    try {
      const uploadBlob = await prepareSourcePhotoForUpload(file);
      const formData = new FormData();
      formData.append('file', uploadBlob, `ai-source-${Date.now()}.jpg`);
      formData.append('title', 'AI 인물 참고 사진');
      formData.append('topic', 'AI 이미지 인물 참고');
      const res = await api.post<Photo>('/api/v1/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSourcePhotoId(res.data.id);
      setSourcePreviewUrl(resolveImageUrl(res.data.original_url) || previewUrl);
      setStatusText('사진이 준비됐어요. 만들기를 누르면 자동으로 적용돼요.');
    } catch (err: unknown) {
      setSourcePhotoId(null);
      setError(sourceUploadMessage(err));
    } finally {
      setIsUploadingSource(false);
    }
  };

  const finishGeneration = useCallback((job: Pick<ImageGenerationJob, 'photo_id' | 'result_url'>) => {
    if (!job.photo_id || !job.result_url) {
      throw new Error('완성된 이미지를 저장하지 못했어요. 다시 시도해 주세요.');
    }
    localStorage.removeItem(activeGenerationJobKey);
    setCompletedResult({
      photoId: job.photo_id,
      resultUrl: job.result_url,
    });
    setError(null);
    setStatusText('이미지가 완성됐어요. 아래에서 확인하고 다운로드할 수 있어요.');
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    localStorage.setItem(activeGenerationJobKey, jobId);
    for (let count = 0; count < maxGenerationPolls; count += 1) {
      const res = await api.get<ImageGenerationJob>(`/api/v1/image-generations/${jobId}`);
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        finishGeneration(res.data);
        return;
      }
      if (res.data.status === 'failed') {
        localStorage.removeItem(activeGenerationJobKey);
        throw new Error(generationMessage(res.data.error_message));
      }
      if (count < 24) {
        setStatusText(count % 2 === 0 ? '색을 고르고 있어요.' : '장면을 예쁘게 다듬고 있어요.');
      } else {
        setStatusText('Kie에서 이미지를 완성하는 중이에요. 창을 닫아도 나중에 이어서 확인할게요.');
      }
      await new Promise((resolve) => window.setTimeout(resolve, generationPollDelayMs));
    }
    throw new Error('이미지가 아직 준비 중이에요. 이 화면을 새로 열면 이어서 확인할 수 있어요.');
  }, [finishGeneration]);

  useEffect(() => {
    const jobId = localStorage.getItem(activeGenerationJobKey);
    if (!jobId) return;

    generationSubmitLockRef.current = true;
    setIsGenerating(true);
    setStatusText('이전에 만들던 이미지를 이어서 확인하고 있어요.');
    pollJob(jobId)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : '이미지 생성 상태를 확인하지 못했어요. 다시 시도해 주세요.');
      })
      .finally(() => {
        setIsGenerating(false);
        generationSubmitLockRef.current = false;
      });
  }, [pollJob]);

  const generate = async () => {
    if (generationSubmitLockRef.current || isGenerating) return;
    if (!selectedTemplate) return;
    generationSubmitLockRef.current = true;
    if (isUploadingSource) {
      generationSubmitLockRef.current = false;
      setError('사진을 아직 올리는 중이에요. 잠시 후 다시 눌러 주세요.');
      return;
    }
    if (selectedTemplate.requires_source_photo && !sourcePhotoId) {
      generationSubmitLockRef.current = false;
      setError('먼저 AI 이미지에 넣을 인물 사진을 올려 주세요.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setCompletedResult(null);
    setStatusText('사진 속 인물을 살려서 새 이미지를 만들고 있어요.');
    try {
      const res = await api.post<ImageGenerationResponse>('/api/v1/image-generations', {
        template_id: selectedTemplate.id,
        variable_values: values,
        source_photo_id: sourcePhotoId,
        provider_options: { aspect_ratio: selectedAspectRatio },
      });
      localStorage.setItem(activeGenerationJobKey, res.data.job_id);
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        finishGeneration({
          photo_id: res.data.photo_id,
          result_url: res.data.result_url,
        });
        return;
      }
      if (res.data.status === 'failed') {
        localStorage.removeItem(activeGenerationJobKey);
        throw new Error(generationMessage(res.data.message));
      }
      await pollJob(res.data.job_id);
    } catch (err: unknown) {
      const detail = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
        : null;
      if (typeof detail === 'string') {
        setError(generationMessage(detail));
      } else if (err instanceof Error) {
        setError(generationMessage(err.message));
      } else {
        setError(generationError);
      }
    } finally {
      setIsGenerating(false);
      generationSubmitLockRef.current = false;
    }
  };

  const downloadCompletedImage = async () => {
    if (!completedResult) return;

    setIsDownloading(true);
    setError(null);
    try {
      const imageUrl = resolveImageUrl(completedResult.resultUrl);
      const response = await fetch(imageUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('download failed');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `story-lens-ai-${completedResult.photoId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError('다운로드하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="story-page-shell">
        <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
          <div className="story-surface-card" style={{ minHeight: 180, padding: 24, display: 'grid', placeItems: 'center' }}>
            <p style={{ fontWeight: 900 }}>AI 카드를 불러오고 있어요.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="story-page-shell story-page-shell--storybook ai-template-page">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <header className="story-page-header">
          <div className="story-page-header__left">
            <button className="story-page-back" type="button" onClick={() => navigate('/')} aria-label="뒤로 가기">
              <span style={{ fontSize: 24 }}>‹</span>
            </button>
          </div>
          <h1 className="story-page-title">AI 이미지 만들기</h1>
          <div className="story-page-header__right" />
        </header>

        <section className="story-hero-card ai-page-hero">
          <div>
            <span className="story-eyebrow">카드 선택형 AI</span>
            <h2>카드를 고르고 사진만 넣으면 완성돼요</h2>
            <p>어려운 프롬프트는 보이지 않게 숨겨두고, 원하는 이미지 카드를 누른 뒤 인물 사진만 올리면 됩니다.</p>
          </div>
          <div className="ai-step-list" aria-label="생성 단계">
            <span>1 카드 선택</span>
            <span>2 사진 업로드</span>
            <span>3 이미지 생성</span>
            <span>4 꾸미기</span>
          </div>
        </section>

        <section className="ai-category-strip" aria-label="카테고리">
          <button
            type="button"
            onClick={() => setCategoryId('all')}
            className={categoryId === 'all' ? 'ai-category-chip ai-category-chip--active' : 'ai-category-chip'}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={categoryId === category.id ? 'ai-category-chip ai-category-chip--active' : 'ai-category-chip'}
            >
              {category.name}
            </button>
          ))}
        </section>

        {completedResult && (
          <section className="story-surface-card ai-result-card" aria-label="완성된 AI 이미지">
            <div className="ai-result-card__copy">
              <span className="story-eyebrow">완성된 이미지</span>
              <h2>이미지가 완성됐어요</h2>
              <p>바로 다운로드하거나 꾸미기 화면에서 프레임과 스티커를 더할 수 있어요.</p>
              <div className="ai-result-actions">
                <button
                  type="button"
                  className="ai-submit-button ai-submit-button--compact"
                  onClick={downloadCompletedImage}
                  disabled={isDownloading}
                >
                  {isDownloading ? '다운로드 중...' : '다운로드'}
                </button>
                <button
                  type="button"
                  className="story-quiet-button"
                  onClick={() => navigate(`/edit/${completedResult.photoId}`)}
                >
                  꾸미기
                </button>
                <button
                  type="button"
                  className="story-quiet-button"
                  onClick={() => {
                    setCompletedResult(null);
                    setStatusText(sourcePhotoId ? '사진이 준비됐어요. 만들기를 누르면 자동으로 적용돼요.' : '');
                  }}
                >
                  다시 만들기
                </button>
              </div>
            </div>
            <div className="ai-result-preview">
              <img src={resolveImageUrl(completedResult.resultUrl)} alt="완성된 AI 이미지" />
            </div>
          </section>
        )}

        {!selectedTemplate ? (
          <section className="ai-template-grid" aria-label="AI 이미지 카드 목록">
            {filteredTemplates.map((template) => {
              const imageUrl = imageFor(template);
              return (
                <button
                  type="button"
                  key={template.id}
                  onClick={() => openTemplate(template)}
                  className="ai-template-card"
                >
                  <div className="ai-template-card__image" style={{ background: swatchFor(template) }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt="" />
                    ) : (
                      <div className="ai-template-card__fallback">
                        <span>
                          <strong>{template.name}</strong>
                          <span>AI 이미지 카드</span>
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ai-template-card__body">
                    <div className="ai-template-card__badges">
                      {template.is_recommended && <span className="story-tag">추천</span>}
                      {template.recommended_age && <span className="story-tag">{template.recommended_age}</span>}
                    </div>
                    <strong className="ai-template-card__title">{template.name}</strong>
                    <span className="ai-template-card__description">
                      {template.description || '사진 한 장으로 새 이미지를 만들어요.'}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="story-surface-card" style={{ padding: 24, fontWeight: 900 }}>
                사용할 수 있는 카드가 아직 없어요.
              </div>
            )}
          </section>
        ) : (
          <div className="ai-workspace">
            <section className="story-surface-card ai-selected-card">
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="story-quiet-button"
                style={{ justifySelf: 'start' }}
              >
                카드 다시 고르기
              </button>
              <div>
                <span className="story-eyebrow">선택한 카드</span>
                <h2 style={{ marginTop: 10, color: '#263246', fontSize: '1.55rem', fontWeight: 950 }}>
                  {selectedTemplate.name}
                </h2>
                <p className="ai-helper-text" style={{ marginTop: 6 }}>
                  {selectedTemplate.description || '사진 속 인물을 살려 새로운 장면을 만들어요.'}
                </p>
              </div>
              <div className="ai-selected-preview" style={{ background: swatchFor(selectedTemplate) }}>
                {imageFor(selectedTemplate) ? (
                  <img src={imageFor(selectedTemplate)} alt="" />
                ) : (
                  <div className="ai-template-card__fallback">
                    <span>
                      <strong>{selectedTemplate.name}</strong>
                      <span>AI 이미지 카드</span>
                    </span>
                  </div>
                )}
              </div>
            </section>

            <aside className="story-surface-card ai-create-panel">
              <div>
                <span className="story-eyebrow">사진 넣기</span>
                <h2 style={{ marginTop: 10, color: '#263246', fontSize: '1.35rem', fontWeight: 950 }}>
                  인물 사진을 올려 주세요
                </h2>
                <p className="ai-helper-text" style={{ marginTop: 4 }}>
                  얼굴이 잘 보이는 사진일수록 같은 사람 느낌을 더 잘 살릴 수 있어요.
                </p>
              </div>

              <label htmlFor="ai-source-photo" className="ai-upload-zone">
                {sourcePreviewUrl ? (
                  <img src={sourcePreviewUrl} alt="AI 이미지에 사용할 인물 사진" />
                ) : (
                  <span className="ai-upload-empty">
                    <span className="ai-upload-icon" aria-hidden="true">+</span>
                    <strong>{isUploadingSource ? '사진을 올리는 중이에요...' : '사진 선택하기'}</strong>
                    <span className="ai-helper-text">선명한 정면 사진을 추천해요.</span>
                  </span>
                )}
              </label>
              <input
                id="ai-source-photo"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                disabled={isUploadingSource || isGenerating}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    uploadSourcePhoto(file);
                  }
                  event.currentTarget.value = '';
                }}
              />

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
                            className={
                              values[variable.key] === choice
                                ? 'ai-category-chip ai-category-chip--active'
                                : 'ai-category-chip'
                            }
                          >
                            {choice}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {acceptsTextOption && (
                <input
                  className="story-field"
                  value={values.text_option ?? ''}
                  placeholder="넣고 싶은 짧은 문구가 있으면 적어 주세요"
                  onChange={(event) => setValues((prev) => ({ ...prev, text_option: event.target.value }))}
                />
              )}

              <div className="ai-aspect-selector">
                <strong>이미지 사이즈</strong>
                <div className="ai-aspect-grid" role="group" aria-label="이미지 비율 선택">
                  {imageAspectRatios.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => setSelectedAspectRatio(ratio)}
                      className={selectedAspectRatio === ratio ? 'ai-aspect-button ai-aspect-button--active' : 'ai-aspect-button'}
                      aria-pressed={selectedAspectRatio === ratio}
                    >
                      <span className="ai-aspect-button__shape" style={aspectShapeStyle(ratio)} />
                      <span>{ratio}</span>
                    </button>
                  ))}
                </div>
              </div>

              {sourcePhotoId && !isGenerating && !error && !completedResult && (
                <div className="ai-status ai-status--success">{statusText}</div>
              )}
              {isUploadingSource && !isGenerating && (
                <div className="ai-status ai-status--info">{statusText}</div>
              )}
              {error && <div className="ai-status ai-status--error">{error}</div>}
              {isGenerating && <div className="ai-status ai-status--info">{statusText}</div>}

              <button
                type="button"
                onClick={generate}
                disabled={isGenerating || isUploadingSource}
                className="ai-submit-button"
              >
                {isGenerating ? '만드는 중...' : '이미지 만들기'}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
