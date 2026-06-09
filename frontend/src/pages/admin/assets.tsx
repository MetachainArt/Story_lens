import { useCallback, useEffect, useState } from 'react';
import api from '@/services/api';
import type { CreativeAsset } from '@/types/ai';
import AdminNav from './AdminNav';

interface AssetForm {
  id: string | null;
  asset_type: string;
  name: string;
  label: string;
  asset_url: string;
  preview_url: string;
  payload_json: string;
  is_public: boolean;
  is_active: boolean;
}

const emptyForm: AssetForm = {
  id: null,
  asset_type: 'sticker',
  name: '',
  label: '',
  asset_url: '',
  preview_url: '',
  payload_json: JSON.stringify({ text: '★', color: '#D4845A' }, null, 2),
  is_public: true,
  is_active: true,
};

function parsePayload(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toForm(asset: CreativeAsset): AssetForm {
  return {
    id: asset.id,
    asset_type: asset.asset_type,
    name: asset.name,
    label: asset.label,
    asset_url: asset.asset_url ?? '',
    preview_url: asset.preview_url ?? '',
    payload_json: JSON.stringify(asset.payload, null, 2),
    is_public: asset.is_public,
    is_active: asset.is_active,
  };
}

export default function AdminAssetsPage() {
  const [assets, setAssets] = useState<CreativeAsset[]>([]);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    const res = await api.get<CreativeAsset[]>('/api/v1/admin/creative-assets');
    setAssets(res.data);
  }, []);

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const res = await api.get<CreativeAsset[]>('/api/v1/admin/creative-assets');
        if (!ignore) {
          setAssets(res.data);
        }
      } catch {
        if (!ignore) {
          setMessage('꾸미기 항목을 불러오지 못했어요.');
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
      asset_type: form.asset_type,
      name: form.name.trim(),
      label: form.label.trim(),
      asset_url: form.asset_url.trim() || null,
      preview_url: form.preview_url.trim() || null,
      payload: parsePayload(form.payload_json),
      is_public: form.is_public,
      is_active: form.is_active,
      sort_order: 0,
    };
    try {
      if (form.id) {
        await api.put(`/api/v1/admin/creative-assets/${form.id}`, payload);
        setMessage('꾸미기 항목을 수정했어요.');
      } else {
        await api.post('/api/v1/admin/creative-assets', payload);
        setMessage('꾸미기 항목을 추가했어요.');
      }
      setForm(emptyForm);
      await loadData();
    } catch {
      setMessage('저장하지 못했어요. 이름, 표시 이름, JSON을 확인해 주세요.');
    }
  };

  return (
    <main className="story-page-shell">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <AdminNav title="꾸미기 관리" />
        {message && <div className="story-surface-card" style={{ padding: 14, fontWeight: 800 }}>{message}</div>}
        <div className="ai-admin-layout">
          <section style={{ display: 'grid', gap: 10, alignSelf: 'start' }}>
            <button className="story-cta-primary" onClick={() => setForm(emptyForm)} style={{ minHeight: 48, fontWeight: 900, cursor: 'pointer' }}>새 항목 추가</button>
            {assets.map((asset) => (
              <button
                key={asset.id}
                className="story-surface-card"
                onClick={() => setForm(toForm(asset))}
                style={{ padding: 14, textAlign: 'left', border: '1.5px solid var(--color-border)', cursor: 'pointer' }}
              >
                <strong>{asset.label}</strong>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                  {asset.asset_type} · {asset.is_active ? 'ON' : 'OFF'} · {asset.is_public ? '공개' : '비공개'}
                </p>
              </button>
            ))}
          </section>

          <section className="story-surface-card" style={{ padding: 16, display: 'grid', gap: 12 }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 900 }}>{form.id ? '항목 수정' : '항목 추가'}</h2>
            <select className="story-field" value={form.asset_type} onChange={(event) => setForm((prev) => ({ ...prev, asset_type: event.target.value }))}>
              <option value="frame">프레임</option>
              <option value="sticker">스티커</option>
              <option value="emoji">이모티콘</option>
              <option value="speech">말풍선</option>
              <option value="text">텍스트</option>
            </select>
            <input className="story-field" value={form.name} placeholder="시스템 이름" onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            <input className="story-field" value={form.label} placeholder="사용자 표시 이름" onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} />
            <input className="story-field" value={form.asset_url} placeholder="이미지 URL" onChange={(event) => setForm((prev) => ({ ...prev, asset_url: event.target.value }))} />
            <input className="story-field" value={form.preview_url} placeholder="미리보기 URL" onChange={(event) => setForm((prev) => ({ ...prev, preview_url: event.target.value }))} />
            <textarea className="story-field" value={form.payload_json} placeholder="payload JSON" onChange={(event) => setForm((prev) => ({ ...prev, payload_json: event.target.value }))} style={{ minHeight: 140, paddingTop: 12, fontFamily: 'monospace', fontSize: 13 }} />
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
