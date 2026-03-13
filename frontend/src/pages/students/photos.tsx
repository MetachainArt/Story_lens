import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Photo } from '@/types/photo';
import type { User } from '@/types/auth';
import PageHeader from '@/components/common/PageHeader';
import { SecondaryButton } from '@/components/common/Button';
import { resolveImageUrl } from '@/utils/storage';
import api from '@/services/api';

export default function StudentPhotosPage() {
  const navigate = useNavigate();
  const { studentId } = useParams<{ studentId: string }>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [studentName, setStudentName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!studentId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Load student list to find this student's name
      const usersRes = await api.get('/api/v1/users');
      const students: User[] = Array.isArray(usersRes.data) ? usersRes.data : [];
      const student = students.find((s) => s.id === studentId);
      setStudentName(student?.name || '학생');

      // Load student's photos
      const photosRes = await api.get('/api/v1/photos', { params: { student_id: studentId } });
      const data = Array.isArray(photosRes.data) ? photosRes.data : [];
      setPhotos(data);
    } catch {
      setPhotos([]);
      setError('사진을 불러오지 못했어요');
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="story-page-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="story-page-shell">
      <PageHeader title={`${studentName}의 사진`} showBack onBack={() => navigate('/students')} />

      <main className="story-content-container">
        {error ? (
          <section className="story-surface-card" style={{ padding: 20, textAlign: 'center' }}>
            <p style={{ color: 'var(--color-error)', marginBottom: 12 }}>{error}</p>
            <SecondaryButton onClick={loadData} size="md" className="story-cta-with-icon">
              <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                <span className="story-icon-emoji">&#x1F504;</span>
              </span>
              <span>다시 가져오기</span>
            </SecondaryButton>
          </section>
        ) : photos.length === 0 ? (
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
              <span style={{ fontSize: '2rem' }}>&#x1F4F7;</span>
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
                아직 사진이 없어요
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                {studentName}님이 사진을 촬영하면 여기에 표시돼요
              </p>
            </div>
          </section>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {photos.map((photo) => {
              const thumbnailUrl = resolveImageUrl(photo.thumbnail_url || photo.edited_url || photo.original_url);

              return (
                <div
                  key={photo.id}
                  className="story-surface-card"
                  style={{
                    position: 'relative',
                    aspectRatio: '1/1',
                    borderRadius: 'var(--radius-2xl)',
                    overflow: 'hidden',
                    border: '1.5px solid var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <button
                    onClick={() => navigate(`/gallery/${photo.id}`)}
                    aria-label="사진 상세 보기"
                    style={{
                      width: '100%',
                      height: '100%',
                      padding: 0,
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      display: 'block',
                    }}
                  >
                    <img src={thumbnailUrl} alt={photo.title || '사진'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>

                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(74,55,40,0.6))',
                      padding: '16px 8px 6px',
                      pointerEvents: 'none',
                    }}
                  >
                    <p style={{ color: '#FFF8F0', fontSize: '0.7rem', fontFamily: 'var(--font-family)' }}>
                      {formatDate(photo.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <SecondaryButton onClick={() => navigate('/students')} fullWidth className="story-cta-with-icon">
            <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
              <span className="story-icon-emoji">&#x2B05;&#xFE0F;</span>
            </span>
            <span>학생 목록으로</span>
          </SecondaryButton>
        </div>
      </main>
    </div>
  );
}
