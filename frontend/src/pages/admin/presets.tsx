import { useCallback, useEffect, useState } from 'react';
import api from '@/services/api';
import type { AdjustmentPreset } from '@/types/ai';
import AdminNav from './AdminNav';

interface PresetForm {
  id: string | null;
  name: string;
  label: string;
  css_filter: string;
  values_json: string;
  preview_url: string;
  is_public: boolean;
  is_active: boolean;
}

const emptyForm: PresetForm = {
  id: null,
  name: '',
  label: '',
  css_filter: 'none',
  values_json: JSON.stringify({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, sharpness: 0 }, null, 2),
  preview_url: '',
  is_public: true,
  is_active: true,
};

function parseValues(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toForm(preset: AdjustmentPreset): PresetForm {
  return {
    id: preset.id,
    name: preset.name,
    label: preset.label,
    css_filter: preset.css_filter,
    values_json: JSON.stringify(preset.values, null, 2),
    preview_url: preset.preview_url ?? '',
    is_public: preset.is_public,
    is_active: preset.is_active,
  };
}

export default function AdminPresetsPage() {
  const [presets, setPresets] = useState<AdjustmentPreset[]>([]);
  const [form, setForm] = useState<PresetForm>(emptyForm);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    const res = await api.get<AdjustmentPreset[]>('/api/v1/admin/adjustment-presets');
    setPresets(res.data);
  }, []);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const res = await api.get<AdjustmentPreset[]>('/api/v1/admin/adjustment-presets');
        if (!ignore) {
          setPresets(res.data);
        }
      } catch {
        if (!ignore) {
          setMessage('보정 프리셋을 불러오지 못했어요.');
        }
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, []);

  const save = async () => {
    const payload = {
      name: form.name.trim(),
      label: form.label.trim(),
      css_filter: form.css_filter.trim() || 'none',
      values: parseValues(form.values_json),
      preview_url: form.preview_url.trim() || null,
      is_public: form.is_public,
      is_active: form.is_active,
      sort_order: 0,
    };
    try {
      if (form.id) {
        await api.put(`/api/v1/admin/adjustment-presets/${form.id}`, payload);
        setMessage('프리셋을 수정했어요.');
      } else {
        await api.post('/api/v1/admin/adjustment-presets', payload);
        setMessage('프리셋을 추가했어요.');
      }
      setForm(emptyForm);
      await loadData();
    } catch {
      setMessage('저장하지 못했어요. CSS 필터와 JSON을 확인해 주세요.');
    }
  };

  return (
    <main className="story-page-shell">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <AdminNav title="보정 프리셋 관리" />
        {message && <div className="story-surface-card" style={{ padding: 14, fontWeight: 800 }}>{message}</div>}
        <div className="ai-admin-layout">
          <section style={{ display: 'grid', gap: 10, alignSelf: 'start' }}>
            <button className="story-cta-primary" onClick={() => setForm(emptyForm)} style={{ minHeight: 48, fontWeight: 900, cursor: 'pointer' }}>새 프리셋 추가</button>
            {presets.map((preset) => (
              <button
                key={preset.id}
                className="story-surface-card"
                onClick={() => setForm(toForm(preset))}
                style={{ padding: 14, textAlign: 'left', border: '1.5px solid var(--color-border)', cursor: 'pointer' }}
              >
                <strong>{preset.label}</strong>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>{preset.name} · {preset.is_active ? 'ON' : 'OFF'}</p>
              </button>
            ))}
          </section>

          <section className="story-surface-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900 }}>{form.id ? '프리셋 수정' : '프리셋 추가'}</h2>
            <input className="story-field" value={form.name} placeholder="시스템 이름" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="story-field" value={form.label} placeholder="사용자 표시 이름" onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
            <input className="story-field" value={form.css_filter} placeholder="CSS filter" onChange={(event) => setForm((prev) => ({ ...prev, css_filter: event.target.value }))} />
            <input className="story-field" value={form.preview_url} placeholder="미리보기 URL" onChange={(event) => setForm((prev) => ({ ...prev, preview_url: event.target.value }))} />
            <textarea className="story-field" value={form.values_json} placeholder="values JSON" onChange={(event) => setForm((prev) => ({ ...prev, values_json: event.target.value }))} style={{ minHeight: 140, paddingTop: 12, fontFamily: 'monospace', fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                <input type="checkbox" checked={form.is_public} onChange={(event) => setForm((prev) => ({ ...prev, is_public: event.target.checked }))} />
                공개
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                <input type="checkbox" checked={form.is_active} onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))} />
                활성화
              </label>
            </div>
            <button className="story-cta-primary" onClick={save} style={{ minHeight: 52, fontWeight: 900, cursor: 'pointer' }}>저장</button>
          </section>
        </div>
      </div>
    </main>
  );
}
