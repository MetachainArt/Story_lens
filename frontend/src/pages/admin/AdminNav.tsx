import { useNavigate } from 'react-router-dom';

const links = [
  { path: '/admin/templates', label: '템플릿' },
  { path: '/admin/assets', label: '꾸미기' },
  { path: '/admin/presets', label: '보정' },
  { path: '/admin/template-usage', label: '사용 기록' },
];

export default function AdminNav({ title }: { title: string }) {
  const navigate = useNavigate();
  return (
    <header className="story-page-header" style={{ borderRadius: 'var(--radius-2xl)', height: 'auto', minHeight: 64, flexWrap: 'wrap', gap: 10 }}>
      <div className="story-page-header__left">
        <button className="story-page-back" onClick={() => navigate('/')} aria-label="홈으로 가기">
          <span style={{ fontSize: 24 }}>‹</span>
        </button>
      </div>
      <h1 className="story-page-title">{title}</h1>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {links.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="story-cta-secondary"
            style={{ minHeight: 38, padding: '0 12px', fontWeight: 800, cursor: 'pointer' }}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
