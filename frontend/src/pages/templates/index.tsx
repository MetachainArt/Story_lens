import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/services/api';
import type { Category, ImageGenerationJob, ImageGenerationResponse, PromptTemplate } from '@/types/ai';
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? templates[0] ?? null,
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
      const firstTemplate = templateRes.data[0] ?? null;
      setSelectedId(firstTemplate?.id ?? null);
      setValues(firstValues(firstTemplate));
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
    setIsGenerating(true);
    setError(null);
    setStatusText('예쁜 이미지를 만들고 있어요.');
    try {
      const res = await api.post<ImageGenerationResponse>('/api/v1/image-generations', {
        template_id: selectedTemplate.id,
        variable_values: values,
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
          <h2 style={{ fontSize: '1.35rem', fontWeight: 900, marginBottom: 8 }}>고르고 누르면 완성돼요</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>
            어려운 문장 대신 템플릿과 쉬운 선택지만 골라 이미지를 만들어요.
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

        <div className="ai-template-layout">
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {filteredTemplates.map((template) => {
              const selected = selectedTemplate?.id === template.id;
              const imageUrl = template.thumbnail_url || template.example_image_url;
              return (
                <button
                  key={template.id}
                  onClick={() => setSelectedId(template.id)}
                  style={{
                    textAlign: 'left',
                    border: selected ? '2.5px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    borderRadius: 8,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: selected ? 'var(--shadow-cute)' : 'var(--shadow-sm)',
                  }}
                >
                  <div style={{ aspectRatio: '4 / 3', background: swatchFor(template), overflow: 'hidden' }}>
                    {imageUrl && (
                      <img src={resolveImageUrl(imageUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          </section>

          <aside className="story-surface-card" style={{ padding: 16, alignSelf: 'start', display: 'grid', gap: 14 }}>
            {selectedTemplate ? (
              <>
                <div>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', fontWeight: 700 }}>선택한 템플릿</p>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>{selectedTemplate.name}</h2>
                </div>

                {selectedTemplate.variables.map((variable) => (
                  <div key={variable.key} style={{ display: 'grid', gap: 8 }}>
                    <label htmlFor={`var-${variable.key}`} style={{ fontWeight: 800 }}>
                      {variable.label}
                    </label>
                    {variable.input_type === 'choice' && variable.choices.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {variable.choices.slice(0, 8).map((choice) => {
                          const active = values[variable.key] === choice;
                          return (
                            <button
                              key={choice}
                              onClick={() => setValues((prev) => ({ ...prev, [variable.key]: choice }))}
                              className={active ? 'story-cta-primary' : 'story-cta-secondary'}
                              style={{ minHeight: 40, padding: '0 12px', fontWeight: 800, cursor: 'pointer' }}
                            >
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        id={`var-${variable.key}`}
                        className="story-field"
                        value={values[variable.key] ?? ''}
                        placeholder="짧게 입력해 주세요"
                        onChange={(event) => setValues((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                      />
                    )}
                    {variable.helper_text && (
                      <p style={{ color: 'var(--color-text-light)', fontSize: '0.82rem' }}>{variable.helper_text}</p>
                    )}
                  </div>
                ))}

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
                  disabled={isGenerating}
                  className="story-cta-primary"
                  style={{ minHeight: 56, fontSize: '1.05rem', fontWeight: 900, cursor: isGenerating ? 'wait' : 'pointer', opacity: isGenerating ? 0.7 : 1 }}
                >
                  {isGenerating ? '만드는 중...' : '이미지 만들기'}
                </button>
              </>
            ) : (
              <p style={{ fontWeight: 800 }}>사용할 수 있는 템플릿이 아직 없어요.</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
