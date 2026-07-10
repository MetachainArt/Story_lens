import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

const links = [
  { path: '/admin/templates', label: '템플릿' },
  { path: '/admin/assets', label: '꾸미기' },
  { path: '/admin/presets', label: '보정' },
  { path: '/admin/template-usage', label: '사용 기록' },
];

export default function AdminNav({ title }: { title: string }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const visibleLinks = links.filter(
    (link) => link.path !== '/admin/templates' || user?.can_manage_templates === true,
  );
  return (
    <header className="story-page-header story-admin-header" style={{ height: 'auto', flexWrap: 'wrap', gap: 10 }}>
      <div className="story-page-header__left">
        <button className="story-page-back" onClick={() => navigate('/')} aria-label="홈으로 가기">
          <span style={{ fontSize: 24 }}>‹</span>
        </button>
      </div>
      <h1 className="story-page-title">{title}</h1>
      <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }} aria-label="관리자 메뉴">
        {visibleLinks.map((link) => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className="ai-category-chip"
            style={{ minHeight: 38, padding: '0 12px' }}
          >
            {link.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
