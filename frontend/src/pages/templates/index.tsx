import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { Category, ImageGenerationJob, ImageGenerationResponse, PromptTemplate } from '@/types/ai';
import type { Photo } from '@/types/photo';
import { resolveImageUrl } from '@/utils/storage';

type Values = Record<string, string>;

const friendlyError = '이 주제는 사용할 수 없어요. 다른 예쁜 주제로 바꿔볼까요?';

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
    'linear-gradient(135deg, #E8EEF8 0%, #FFF8F0 100%)',
    'linear-gradient(135deg, #FDEBD2 0%, #D8E7CF 100%)',
    'linear-gradient(135deg, #F5EFFA 0%, #E8EEF8 100%)',
    'linear-gradient(135deg, #FFE3D5 0%, #CFE3E8 100%)',
  ];
  return palettes[template.name.length % palettes.length];
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

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [selectedId, templates]
  );

  const filteredTemplates = useMemo(() => {
    if (categoryId === 'all') return templates;
    return templates.filter((item) => item.category_id === categoryId);
  }, [categoryId, templates]);

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
  }, [selectedTemplate]);

  const openTemplate = (template: PromptTemplate) => {
    setSelectedId(template.id);
    setValues(firstValues(template));
    setError(null);
    setStatusText('');
    setSourcePhotoId(null);
    setSourcePreviewUrl(null);
  };

  const uploadSourcePhoto = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('인물 사진 파일을 넣어 주세요.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setSourcePreviewUrl(previewUrl);
    setSourcePhotoId(null);
    setIsUploadingSource(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', 'AI 인물 참고 사진');
      formData.append('topic', 'AI 이미지 인물 참고');
      const res = await api.post<Photo>('/api/v1/photos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSourcePhotoId(res.data.id);
      setSourcePreviewUrl(resolveImageUrl(res.data.original_url) || previewUrl);
      setStatusText('사진을 넣었어요. 이제 원하는 스타일을 골라 주세요.');
    } catch {
      setSourcePhotoId(null);
      setError('사진을 올리지 못했어요. 다른 사진으로 다시 시도해 주세요.');
    } finally {
      setIsUploadingSource(false);
    }
  };

  const pollJob = useCallback(async (jobId: string) => {
    for (let count = 0; count < 40; count += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      const res = await api.get<ImageGenerationJob>(`/api/v1/image-generations/${jobId}`);
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        navigate(`/edit/${res.data.photo_id}`);
        return;
      }
      if (res.data.status === 'failed') {
        throw new Error(res.data.error_message || friendlyError);
      }
      setStatusText(count % 2 === 0 ? '색을 고르고 있어요.' : '장면을 예쁘게 다듬고 있어요.');
    }
    throw new Error('이미지가 아직 준비 중이에요. 잠시 뒤 다시 확인해 주세요.');
  }, [navigate]);

  const generate = async () => {
    if (!selectedTemplate) return;
    if (!sourcePhotoId) {
      setError('먼저 AI 이미지에 넣을 인물 사진을 올려 주세요.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    setStatusText('사진 속 인물을 살려서 새 이미지를 만들고 있어요.');
    try {
      const res = await api.post<ImageGenerationResponse>('/api/v1/image-generations', {
        template_id: selectedTemplate.id,
        variable_values: values,
        source_photo_id: sourcePhotoId,
        provider_options: {},
      });
      if (res.data.status === 'succeeded' && res.data.photo_id) {
        navigate(`/edit/${res.data.photo_id}`);
        return;
      }
      await pollJob(res.data.job_id);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : friendlyError);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <main className="story-page-shell">
        <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
          <div className="story-surface-card" style={{ minHeight: 180, padding: 24 }}>
            <p style={{ fontWeight: 800 }}>템플릿을 불러오고 있어요.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="story-page-shell story-bg-creative">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <header className="story-page-header" style={{ borderRadius: 'var(--radius-2xl)' }}>
          <div className="story-page-header__left">
            <button className="story-page-back" onClick={() => navigate('/')} aria-label="뒤로 가기">
              <span style={{ fontSize: 24 }}>‹</span>
            </button>
          </div>
          <h1 className="story-page-title">AI 이미지 만들기</h1>
          <div className="story-page-header__right" />
        </header>

        <section className="story-hero-card">
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: 8 }}>카드를 고르고 사진만 넣으면 완성돼요</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            어려운 프롬프트는 숨겨두고, 아이들은 원하는 카드와 사진만 고르면 AI 이미지가 만들어져요.
          </p>
        </section>

        <section style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          <button
            onClick={() => setCategoryId('all')}
            className={categoryId === 'all' ? 'story-cta-primary' : 'story-cta-secondary'}
            style={{ minWidth: 92, minHeight: 44, padding: '0 14px', fontWeight: 800, cursor: 'pointer' }}
          >
            전체
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryId(category.id)}
              className={categoryId === category.id ? 'story-cta-primary' : 'story-cta-secondary'}
              style={{ minWidth: 110, minHeight: 44, padding: '0 14px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              {category.name}
            </button>
          ))}
        </section>

        {!selectedTemplate ? (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
            {filteredTemplates.map((template) => {
              const imageUrl = template.thumbnail_url || template.example_image_url;
              return (
                <button
                  key={template.id}
                  onClick={() => openTemplate(template)}
                  style={{
                    textAlign: 'left',
                    border: '1.5px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ aspectRatio: '4 / 3', background: swatchFor(template), overflow: 'hidden', display: 'grid', placeItems: 'center' }}>
                    {imageUrl ? (
                      <img src={resolveImageUrl(imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ textAlign: 'center', padding: 14, fontWeight: 900, color: 'var(--color-text-primary)' }}>
                        <div style={{ fontSize: '1.15rem', marginBottom: 6 }}>{template.name}</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>AI 카드 템플릿</div>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: 12, display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {template.is_recommended && <span className="story-tag">추천</span>}
                      {template.recommended_age && <span className="story-tag">{template.recommended_age}</span>}
                    </div>
                    <strong style={{ fontSize: '1rem' }}>{template.name}</strong>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.86rem', lineHeight: 1.4 }}>
                      {template.description || '쉬운 선택으로 이미지를 만들어요.'}
                    </span>
                  </div>
                </button>
              );
            })}
            {filteredTemplates.length === 0 && (
              <div className="story-surface-card" style={{ padding: 20, fontWeight: 800 }}>
                사용할 수 있는 카드가 아직 없어요.
              </div>
            )}
          </section>
        ) : (
          <div className="ai-template-layout">
            <section className="story-surface-card" style={{ padding: 16, alignSelf: 'start', display: 'grid', gap: 14 }}>
              <button
                onClick={() => setSelectedId(null)}
                className="story-cta-secondary"
                style={{ minHeight: 42, padding: '0 12px', justifySelf: 'start', fontWeight: 800, cursor: 'pointer' }}
              >
                카드 다시 고르기
              </button>
              <div>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 700 }}>선택한 카드</p>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 900 }}>{selectedTemplate.name}</h2>
                <p style={{ color: 'var(--color-text-secondary)', marginTop: 6 }}>{selectedTemplate.description}</p>
              </div>
              <div style={{ aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', background: swatchFor(selectedTemplate), display: 'grid', placeItems: 'center' }}>
                {selectedTemplate.thumbnail_url || selectedTemplate.example_image_url ? (
                  <img
                    src={resolveImageUrl(selectedTemplate.thumbnail_url || selectedTemplate.example_image_url)}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <strong style={{ fontSize: '1.25rem', textAlign: 'center', padding: 16 }}>{selectedTemplate.name}</strong>
                )}
              </div>
            </section>

            <aside className="story-surface-card" style={{ padding: 16, alignSelf: 'start', display: 'grid', gap: 14 }}>
                <div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 700 }}>사진 넣기</p>
                  <h2 style={{ fontSize: '1.18rem', fontWeight: 900 }}>인물 사진을 올려 주세요</h2>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                    얼굴이 잘 보이는 사진일수록 같은 사람 느낌을 더 잘 살릴 수 있어요.
                  </p>
                </div>

                <label
                  htmlFor="ai-source-photo"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    minHeight: 220,
                    border: '2px dashed var(--color-border)',
                    borderRadius: 8,
                    background: '#FFFDF8',
                    cursor: isUploadingSource ? 'wait' : 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  {sourcePreviewUrl ? (
                    <img src={sourcePreviewUrl} alt="AI 이미지에 사용할 인물 사진" style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontWeight: 900, color: 'var(--color-text-secondary)' }}>
                      {isUploadingSource ? '사진을 올리는 중이에요...' : '사진 선택하기'}
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

                {sourcePhotoId && (
                  <p style={{ color: 'var(--color-success)', fontWeight: 800 }}>
                    사진이 준비됐어요. 만들기를 누르면 자동으로 적용돼요.
                  </p>
                )}

                <input
                  className="story-field"
                  value={values.text_option ?? ''}
                  placeholder="넣고 싶은 짧은 문구가 있으면 적어 주세요"
                  onChange={(event) => setValues((prev) => ({ ...prev, text_option: event.target.value }))}
                />

                {error && (
                  <div style={{ padding: 12, borderRadius: 8, background: '#FFF0E8', color: 'var(--color-text-primary)', fontWeight: 700 }}>
                    {error}
                  </div>
                )}

                {isGenerating && (
                  <div style={{ padding: 12, borderRadius: 8, background: '#E8EEF8', color: 'var(--color-text-primary)', fontWeight: 800 }}>
                    {statusText}
                  </div>
                )}

                <button
                  onClick={generate}
                  disabled={isGenerating || isUploadingSource}
                  className="story-cta-primary"
                  style={{ minHeight: 56, fontSize: '1.05rem', fontWeight: 900, cursor: isGenerating ? 'wait' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}
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
