import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { Category, PromptTemplate, TemplateVariable } from '@/types/ai';
import AdminNav from './AdminNav';

interface TemplateForm {
  id: string | null;
  category_id: string;
  name: string;
  description: string;
  thumbnail_url: string;
  example_image_url: string;
  recommended_age: string;
  requires_source_photo: boolean;
  aspect_ratio: string;
  visible_user_fields: string;
  base_prompt: string;
  variables_json: string;
  defaults_json: string;
  negative_terms: string;
  is_public: boolean;
  is_active: boolean;
  is_recommended: boolean;
}

const sampleVariables: TemplateVariable[] = [
  { key: 'subject', label: '주인공', input_type: 'choice', choices: ['아이', '고양이', '우주비행사'], default_value: '아이', required: true },
  { key: 'theme', label: '주제', input_type: 'choice', choices: ['여름', '생일', '모험'], default_value: '여름', required: true },
  { key: 'style', label: '스타일', input_type: 'choice', choices: ['동화풍', '스티커풍', '포토카드'], default_value: '동화풍', required: true },
];

const emptyForm: TemplateForm = {
  id: null,
  category_id: '',
  name: '',
  description: '',
  thumbnail_url: '',
  example_image_url: '',
  recommended_age: '전체',
  requires_source_photo: true,
  aspect_ratio: '1:1',
  visible_user_fields: '',
  base_prompt: 'Create a safe, bright {style} image about {subject} in a {theme} scene. Child friendly, warm colors, no text unless requested.',
  variables_json: JSON.stringify(sampleVariables, null, 2),
  defaults_json: JSON.stringify({ subject: '아이', theme: '여름', style: '동화풍' }, null, 2),
  negative_terms: '폭력, 선정적, 무서운 장면, 개인정보, 유명 캐릭터',
  is_public: true,
  is_active: true,
  is_recommended: false,
};

function parseTemplateJson(
  variablesJson: string,
  defaultsJson: string,
): { variables: TemplateVariable[]; defaultValues: Record<string, string>; error: string | null } {
  let parsedVariables: unknown;
  let parsedDefaults: unknown;
  try {
    parsedVariables = JSON.parse(variablesJson) as unknown;
    parsedDefaults = JSON.parse(defaultsJson) as unknown;
  } catch {
    return { variables: [], defaultValues: {}, error: '변수 JSON 또는 기본값 JSON 형식이 올바르지 않아요.' };
  }

  if (!Array.isArray(parsedVariables)) {
    return { variables: [], defaultValues: {}, error: '변수 JSON은 배열 형식이어야 해요.' };
  }
  if (!parsedDefaults || typeof parsedDefaults !== 'object' || Array.isArray(parsedDefaults)) {
    return { variables: [], defaultValues: {}, error: '기본값 JSON은 객체 형식이어야 해요.' };
  }

  const variables: TemplateVariable[] = [];
  for (const [index, item] of parsedVariables.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { variables: [], defaultValues: {}, error: `${index + 1}번째 변수는 객체 형식이어야 해요.` };
    }
    const record = item as Record<string, unknown>;
    if (typeof record.key !== 'string' || !record.key.trim()) {
      return { variables: [], defaultValues: {}, error: `${index + 1}번째 변수에 key가 필요해요.` };
    }
    if (typeof record.label !== 'string' || !record.label.trim()) {
      return { variables: [], defaultValues: {}, error: `${record.key} 변수에 label이 필요해요.` };
    }
    if (record.choices !== undefined && !Array.isArray(record.choices)) {
      return { variables: [], defaultValues: {}, error: `${record.key} 변수의 choices는 배열이어야 해요.` };
    }
    variables.push({
      key: record.key.trim(),
      label: record.label.trim(),
      input_type: typeof record.input_type === 'string' ? record.input_type : 'choice',
      choices: Array.isArray(record.choices) ? record.choices.map(String) : [],
      default_value: record.default_value === undefined || record.default_value === null ? null : String(record.default_value),
      required: typeof record.required === 'boolean' ? record.required : true,
      helper_text: record.helper_text === undefined || record.helper_text === null ? null : String(record.helper_text),
    });
  }

  return {
    variables,
    defaultValues: Object.fromEntries(
      Object.entries(parsedDefaults as Record<string, unknown>).map(([key, value]) => [key, String(value ?? '')]),
    ),
    error: null,
  };
}

function renderPromptPreview(basePrompt: string, variables: TemplateVariable[], defaultValues: Record<string, string>): string {
  return basePrompt.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const variable = variables.find((item) => item.key === key);
    return defaultValues[key] ?? variable?.default_value ?? variable?.choices[0] ?? `{${key}}`;
  });
}

function toForm(template: PromptTemplate): TemplateForm {
  return {
    id: template.id,
    category_id: template.category_id ?? '',
    name: template.name,
    description: template.description ?? '',
    thumbnail_url: template.thumbnail_url ?? '',
    example_image_url: template.example_image_url ?? '',
    recommended_age: template.recommended_age ?? '',
    requires_source_photo: template.requires_source_photo,
    aspect_ratio: template.aspect_ratio || '1:1',
    visible_user_fields: template.visible_user_fields.join(', '),
    base_prompt: template.base_prompt,
    variables_json: JSON.stringify(template.variables, null, 2),
    defaults_json: JSON.stringify(template.default_values, null, 2),
    negative_terms: template.negative_terms.join(', '),
    is_public: template.is_public,
    is_active: template.is_active,
    is_recommended: template.is_recommended,
  };
}

export default function AdminTemplatesPage() {
  const user = useAuthStore((state) => state.user);
  const canManageTemplates = user?.can_manage_templates === true;
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const selected = useMemo(() => templates.find((item) => item.id === form.id) ?? null, [form.id, templates]);
  const preview = useMemo(() => {
    const parsed = parseTemplateJson(form.variables_json, form.defaults_json);
    if (parsed.error) {
      return { prompt: '', error: parsed.error };
    }
    return {
      prompt: renderPromptPreview(form.base_prompt, parsed.variables, parsed.defaultValues),
      error: null,
    };
  }, [form.base_prompt, form.defaults_json, form.variables_json]);

  const loadData = useCallback(async () => {
    if (!canManageTemplates) {
      setTemplates([]);
      setCategories([]);
      return;
    }
    const [templateRes, categoryRes] = await Promise.all([
      api.get<PromptTemplate[]>('/api/v1/admin/prompt-templates'),
      api.get<Category[]>('/api/v1/admin/categories'),
    ]);
    setTemplates(templateRes.data);
    setCategories(categoryRes.data.filter((item) => item.kind === 'template'));
  }, [canManageTemplates]);

  useEffect(() => {
    loadData().catch(() => setMessage('관리자 데이터를 불러오지 못했어요.'));
  }, [loadData]);

  if (!canManageTemplates) {
    return (
      <main className="story-page-shell">
        <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
          <AdminNav title="AI 템플릿 관리" />
          <section className="story-surface-card" style={{ padding: 24, display: 'grid', gap: 10 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 900 }}>템플릿 관리 권한이 없어요.</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontWeight: 700 }}>
              카테고리, 꾸미기 에셋, 보정 프리셋 관리는 기존 선생님 권한으로 사용할 수 있어요.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const buildPayload = (variables: TemplateVariable[], defaultValues: Record<string, string>) => ({
    category_id: form.category_id || null,
    name: form.name.trim(),
    description: form.description.trim() || null,
    thumbnail_url: form.thumbnail_url.trim() || null,
    example_image_url: form.example_image_url.trim() || null,
    recommended_age: form.recommended_age.trim() || null,
    requires_source_photo: form.requires_source_photo,
    aspect_ratio: form.aspect_ratio.trim() || '1:1',
    visible_user_fields: form.visible_user_fields.split(',').map((item) => item.trim()).filter(Boolean),
    base_prompt: form.base_prompt,
    variables,
    default_values: defaultValues,
    negative_terms: form.negative_terms.split(',').map((item) => item.trim()).filter(Boolean),
    is_public: form.is_public,
    is_active: form.is_active,
    is_recommended: form.is_recommended,
  });

  const save = async () => {
    if (!form.name.trim() || !form.base_prompt.trim()) {
      setMessage('템플릿 이름과 기본 프롬프트는 꼭 필요해요.');
      return;
    }
    const parsed = parseTemplateJson(form.variables_json, form.defaults_json);
    if (parsed.error) {
      setMessage(parsed.error);
      return;
    }

    setIsSaving(true);
    setMessage('');
    try {
      if (form.id) {
        await api.put(`/api/v1/admin/prompt-templates/${form.id}`, buildPayload(parsed.variables, parsed.defaultValues));
        setMessage('템플릿을 수정했어요.');
      } else {
        await api.post('/api/v1/admin/prompt-templates', buildPayload(parsed.variables, parsed.defaultValues));
        setMessage('새 템플릿을 추가했어요.');
      }
      setForm(emptyForm);
      await loadData();
    } catch {
      setMessage('저장하지 못했어요. JSON 형식과 필수값을 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const duplicate = async (id: string) => {
    await api.post(`/api/v1/admin/prompt-templates/${id}/duplicate`);
    setMessage('복사본을 만들었어요.');
    await loadData();
  };

  const patchStatus = async (id: string, patch: Partial<Pick<PromptTemplate, 'is_active' | 'is_public' | 'is_recommended'>>) => {
    await api.patch(`/api/v1/admin/prompt-templates/${id}/status`, patch);
    await loadData();
  };

  return (
    <main className="story-page-shell">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <AdminNav title="AI 템플릿 관리" />

        {message && <div className="story-surface-card" style={{ padding: 14, fontWeight: 800 }}>{message}</div>}

        <div className="ai-admin-layout">
          <section style={{ display: 'grid', gap: 10, alignSelf: 'start' }}>
            <button
              onClick={() => setForm(emptyForm)}
              className="story-cta-primary"
              style={{ minHeight: 48, fontWeight: 900, cursor: 'pointer' }}
            >
              새 템플릿 추가
            </button>
            {templates.map((template) => (
              <article
                key={template.id}
                className="story-surface-card"
                style={{ padding: 14, border: selected?.id === template.id ? '2px solid var(--color-primary)' : undefined }}
              >
                <button
                  onClick={() => setForm(toForm(template))}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer' }}
                >
                  <strong style={{ fontSize: '1rem' }}>{template.name}</strong>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    사용 {template.usage_count}회 · {template.is_active ? 'ON' : 'OFF'} · {template.is_public ? '공개' : '비공개'}
                  </p>
                </button>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="story-cta-secondary" style={{ minHeight: 36, padding: '0 10px', cursor: 'pointer' }} onClick={() => duplicate(template.id)}>복제</button>
                  <button className="story-cta-secondary" style={{ minHeight: 36, padding: '0 10px', cursor: 'pointer' }} onClick={() => patchStatus(template.id, { is_active: !template.is_active })}>
                    {template.is_active ? '비활성화' : '활성화'}
                  </button>
                  <button className="story-cta-secondary" style={{ minHeight: 36, padding: '0 10px', cursor: 'pointer' }} onClick={() => patchStatus(template.id, { is_recommended: !template.is_recommended })}>
                    {template.is_recommended ? '추천 해제' : '추천'}
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="story-surface-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900 }}>{form.id ? '템플릿 수정' : '템플릿 추가'}</h2>
            <input className="story-field" value={form.name} placeholder="템플릿 이름" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <textarea className="story-field" value={form.description} placeholder="템플릿 설명" onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} style={{ minHeight: 74, paddingTop: 12 }} />
            <select className="story-field" value={form.category_id} onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}>
              <option value="">카테고리 선택 안 함</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <input className="story-field" value={form.thumbnail_url} placeholder="대표 썸네일 URL" onChange={(event) => setForm((prev) => ({ ...prev, thumbnail_url: event.target.value }))} />
            <input className="story-field" value={form.example_image_url} placeholder="생성 예시 이미지 URL" onChange={(event) => setForm((prev) => ({ ...prev, example_image_url: event.target.value }))} />
            <input className="story-field" value={form.recommended_age} placeholder="추천 연령" onChange={(event) => setForm((prev) => ({ ...prev, recommended_age: event.target.value }))} />
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10 }}>
              <select className="story-field" value={form.aspect_ratio} onChange={(event) => setForm((prev) => ({ ...prev, aspect_ratio: event.target.value }))}>
                <option value="1:1">정사각 1:1</option>
                <option value="4:3">가로 4:3</option>
                <option value="16:9">가로 16:9</option>
                <option value="3:2">가로 3:2</option>
                <option value="2:3">세로 2:3</option>
                <option value="3:4">세로 3:4</option>
                <option value="9:16">세로 9:16</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, padding: '0 12px', border: '1px solid #d0d8e8', borderRadius: 10 }}>
                <input type="checkbox" checked={form.requires_source_photo} onChange={(event) => setForm((prev) => ({ ...prev, requires_source_photo: event.target.checked }))} />
                인물 사진 필수
              </label>
            </div>
            <input className="story-field" value={form.visible_user_fields} placeholder="사용자에게 보일 변수 key (예: mood, color)" onChange={(event) => setForm((prev) => ({ ...prev, visible_user_fields: event.target.value }))} />
            <textarea className="story-field" value={form.base_prompt} placeholder="기본 프롬프트" onChange={(event) => setForm((prev) => ({ ...prev, base_prompt: event.target.value }))} style={{ minHeight: 112, paddingTop: 12 }} />
            <div className="story-surface-card" style={{ padding: 14, display: 'grid', gap: 8, background: '#f8fbff' }}>
              <strong style={{ color: '#263246' }}>프롬프트 미리보기</strong>
              {preview.error ? (
                <p style={{ color: '#b42318', fontWeight: 800, margin: 0 }}>{preview.error}</p>
              ) : (
                <p style={{ color: '#344054', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>
                  {preview.prompt || '기본값을 넣으면 실제 생성 프롬프트가 여기에 보여요.'}
                </p>
              )}
            </div>
            <textarea className="story-field" value={form.variables_json} placeholder="변수 JSON" onChange={(event) => setForm((prev) => ({ ...prev, variables_json: event.target.value }))} style={{ minHeight: 180, paddingTop: 12, fontFamily: 'monospace', fontSize: 13 }} />
            <textarea className="story-field" value={form.defaults_json} placeholder="기본값 JSON" onChange={(event) => setForm((prev) => ({ ...prev, defaults_json: event.target.value }))} style={{ minHeight: 96, paddingTop: 12, fontFamily: 'monospace', fontSize: 13 }} />
            <input className="story-field" value={form.negative_terms} placeholder="금지어, 주의어" onChange={(event) => setForm((prev) => ({ ...prev, negative_terms: event.target.value }))} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {(['is_public', 'is_active', 'is_recommended'] as const).map((key) => (
                <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                  <input type="checkbox" checked={form[key]} onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.checked }))} />
                  {key === 'is_public' ? '공개' : key === 'is_active' ? '활성화' : '추천'}
                </label>
              ))}
            </div>
            <button onClick={save} disabled={isSaving} className="story-cta-primary" style={{ minHeight: 52, fontWeight: 900, cursor: isSaving ? 'wait' : 'pointer' }}>
              {isSaving ? '저장 중...' : '저장'}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
