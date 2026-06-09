import { useEffect, useState } from 'react';
import api from '@/services/api';
import type { TemplateUsage } from '@/types/ai';
import AdminNav from './AdminNav';

function formatDate(value: string | null) {
  if (!value) return '아직 없음';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export default function AdminTemplateUsagePage() {
  const [items, setItems] = useState<TemplateUsage[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let ignore = false;

    const run = async () => {
      try {
        const res = await api.get<TemplateUsage[]>('/api/v1/admin/template-usage');
        if (!ignore) {
          setItems(res.data);
        }
      } catch {
        if (!ignore) {
          setMessage('사용 기록을 불러오지 못했어요.');
        }
      }
    };

    void run();
    return () => {
      ignore = true;
    };
  }, []);

  const total = items.reduce((sum, item) => sum + item.usage_count, 0);

  return (
    <main className="story-page-shell">
      <div className="story-content-container" style={{ display: 'grid', gap: 16 }}>
        <AdminNav title="템플릿 사용 기록" />
        {message && <div className="story-surface-card" style={{ padding: 14, fontWeight: 800 }}>{message}</div>}
        <section className="story-hero-card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: 900 }}>총 {total}회 사용</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>추천 템플릿을 고를 때 실제 사용 기록을 참고하세요.</p>
        </section>
        <section style={{ display: 'grid', gap: 10 }}>
          {items.map((item, index) => (
            <article key={item.template_id} className="story-surface-card" style={{ padding: 16, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{index + 1}. {item.template_name}</strong>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>최근 사용: {formatDate(item.last_used_at)}</p>
                </div>
                <span className="story-tag" style={{ fontWeight: 900 }}>{item.usage_count}회</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, background: 'var(--color-bg-soft)', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${total > 0 ? Math.max(8, (item.usage_count / total) * 100) : 0}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #6A8CAF 0%, #D4845A 100%)',
                  }}
                />
              </div>
            </article>
          ))}
          {items.length === 0 && (
            <div className="story-surface-card" style={{ padding: 24, textAlign: 'center', fontWeight: 800 }}>
              아직 사용 기록이 없어요.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
