import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@/types/auth';
import PageHeader from '@/components/common/PageHeader';
import { SecondaryButton } from '@/components/common/Button';
import api from '@/services/api';

export default function StudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get('/api/v1/users');
      const data = Array.isArray(response.data) ? response.data : [];
      setStudents(data);
    } catch {
      setStudents([]);
      setError('학생 목록을 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  if (isLoading) {
    return (
      <div className="story-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="story-page-shell">
      <PageHeader title="학생 사진 보기" showBack onBack={() => navigate('/')} />

      <main className="story-content-container">
        {error ? (
          <section className="story-surface-card" style={{ padding: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 12 }}>{error}</p>
            <SecondaryButton onClick={loadStudents} size="md" className="story-cta-with-icon">
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F504;</span>
              </span>
              <span>다시 가져오기</span>
            </SecondaryButton>
          </section>
        ) : students.length === 0 ? (
          <section
            className="story-surface-card"
            style={{
              minHeight: 380,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              padding: 24,
            }}
          >
            <div
              className="story-icon-3d"
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'var(--color-primary-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px dashed var(--color-border)',
              }}
            >
              <span style={{ fontSize: '2rem' }}>&#x1F9D1;&#x200D;&#x1F393;</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  marginBottom: 6,
                  fontFamily: 'var(--font-family-serif)',
                }}
              >
                등록된 학생이 없어요
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>학생이 가입하면 여기에 표시돼요</p>
            </div>
          </section>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {students.map((student) => (
              <button
                key={student.id}
                onClick={() => navigate(`/students/${student.id}/photos`)}
                className="story-surface-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '16px 18px',
                  cursor: 'pointer',
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'transform var(--duration-fast) var(--easing-ease-out), box-shadow var(--duration-fast)',
                }}
              >
                <div
                  className="story-icon-3d"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-primary-light) 0%, #F0D5B8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '1.3rem' }}>&#x1F9D2;</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: '1.05rem',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-family)',
                      marginBottom: 2,
                    }}
                  >
                    {student.name || student.email}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                    {student.email}
                  </p>
                </div>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem' }}>&#x276F;</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <SecondaryButton onClick={() => navigate('/')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x1F3E0;</span>
            </span>
            <span>홈으로</span>
          </SecondaryButton>
        </div>
      </main>
    </div>
  );
}
