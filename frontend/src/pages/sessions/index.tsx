import { useEffect, useMemo, useState, type FormEvent, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

import PageHeader from '@/components/common/PageHeader';
import { PrimaryButton } from '@/components/common/Button';
import sessionsService from '@/services/sessions';
import type { Session } from '@/types/session';

type ViewMode = 'monthly' | 'yearly';

interface DefaultSchedule {
  month: number;
  title: string;
  location: string;
  description: string;
  date: string;
  imageUrl: string;
  keywords: string[];
}

const DEFAULT_SCHEDULES: DefaultSchedule[] = [
  {
    month: 3,
    title: '봄의 첫 번째 만남',
    location: '한강 공원',
    description: '따뜻한 봄날, 가벼운 산책과 사진이 잘 어울리는 코스입니다.',
    date: '2026-03-15',
    imageUrl: 'https://images.unsplash.com/photo-1722501569916-cbec540b8a98?w=800&h=400&fit=crop&q=80',
    keywords: ['공원', '봄나들이', '야경'],
  },
  {
    month: 4,
    title: '동네 공원 탐험',
    location: '학교 근처 공원',
    description: '가벼운 산책과 스토리 보드 작성을 시작하기 좋은 공간을 제안합니다.',
    date: '2026-04-05',
    imageUrl: 'https://images.unsplash.com/photo-1744444206134-a846b606b21b?w=800&h=400&fit=crop&q=80',
    keywords: ['공원', '주말', '여행'],
  },
  {
    month: 5,
    title: '노을 산책',
    location: '도심 야경',
    description: '노을빛이 예쁜 골목길에서 한 장면씩 기록해보세요.',
    date: '2026-05-10',
    imageUrl: 'https://images.unsplash.com/photo-1557938187-af371ef22476?w=800&h=400&fit=crop&q=80',
    keywords: ['노을', '도시', '데이트'],
  },
  {
    month: 6,
    title: '휴식과 힐링',
    location: '남산',
    description: '긴 하루를 정리하고, 조용한 풍경을 배경으로 편안한 이야기를 남겨요.',
    date: '2026-06-14',
    imageUrl: 'https://images.unsplash.com/photo-1670735411734-c9725326de3f?w=800&h=400&fit=crop&q=80',
    keywords: ['산', '힐링', '산책'],
  },
  {
    month: 7,
    title: '여름 이야기',
    location: '바닷가',
    description: '물빛과 바람을 담은 사진에 감성을 붙여보세요.',
    date: '2026-07-19',
    imageUrl: 'https://images.unsplash.com/photo-1647767459550-1e35617029ec?w=800&h=400&fit=crop&q=80',
    keywords: ['바다', '휴가', '여행'],
  },
  {
    month: 8,
    title: '야외 액티비티',
    location: '시민 공원',
    description: '가볍고 활동적인 주말을 기록하기 위한 장소 추천입니다.',
    date: '2026-08-09',
    imageUrl: 'https://images.unsplash.com/photo-1688544994167-79cf8c9e5b29?w=800&h=400&fit=crop&q=80',
    keywords: ['활동', '공원', '가족'],
  },
  {
    month: 9,
    title: '가을의 준비',
    location: '단풍 산책로',
    description: '가을 느낌이 좋은 코스에서 짧고 따뜻한 이야기를 준비해보세요.',
    date: '2026-09-20',
    imageUrl: 'https://images.unsplash.com/photo-1693928105595-b323b02791ff?w=800&h=400&fit=crop&q=80',
    keywords: ['단풍', '산책', '가을'],
  },
  {
    month: 10,
    title: '낙엽과 바람',
    location: '숲길',
    description: '잔잔한 자연 풍경을 한 컷씩 담아 기억을 정리하기 좋은 일정입니다.',
    date: '2026-10-18',
    imageUrl: 'https://images.unsplash.com/photo-1697171796903-74f6a1367ba2?w=800&h=400&fit=crop&q=80',
    keywords: ['가을', '숲', '낙엽'],
  },
  {
    month: 11,
    title: '겨울 입문',
    location: '도심 야경',
    description: '바람이 선명한 날씨에서 색감을 살린 기록을 남겨보세요.',
    date: '2026-11-08',
    imageUrl: 'https://images.unsplash.com/photo-1769523423568-9972f193cd68?w=800&h=400&fit=crop&q=80',
    keywords: ['겨울', '야경', '일상'],
  },
  {
    month: 12,
    title: '한 해의 마무리',
    location: '크리스마스 마켓',
    description: '따뜻한 조명 아래, 한 해를 돌아보며 마지막 이야기를 기록해요.',
    date: '2026-12-20',
    imageUrl: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=800&h=400&fit=crop&q=80',
    keywords: ['크리스마스', '마무리', '겨울'],
  },
];

const monthFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
});

function toMonthValue(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonth(value: string): { year: number; month: number } | null {
  const [yearText, monthText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

function formatDateKR(dateString: string): string {
  const d = new Date(dateString + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

const cardStyle: CSSProperties = {
  borderRadius: 'var(--radius-2xl)',
  overflow: 'hidden',
  background: 'white',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-sm)',
};

const cardImageStyle: CSSProperties = {
  width: '100%',
  height: 180,
  objectFit: 'cover',
  display: 'block',
};

const cardBodyStyle: CSSProperties = {
  padding: '14px 16px',
};

const tagStyle: CSSProperties = {
  display: 'inline-block',
  padding: '2px 10px',
  borderRadius: '999px',
  fontSize: '0.78rem',
  fontWeight: 600,
  background: 'var(--color-bg-soft)',
  color: 'var(--color-text-secondary)',
  border: '1px solid var(--color-border)',
};

const SEASON_COLORS: Record<number, { bg: string; accent: string; label: string }> = {
  3: { bg: '#f0fdf4', accent: '#22c55e', label: 'SPRING' },
  4: { bg: '#f0fdf4', accent: '#16a34a', label: 'SPRING' },
  5: { bg: '#f0fdf4', accent: '#15803d', label: 'SPRING' },
  6: { bg: '#eff6ff', accent: '#3b82f6', label: 'SUMMER' },
  7: { bg: '#eff6ff', accent: '#2563eb', label: 'SUMMER' },
  8: { bg: '#eff6ff', accent: '#1d4ed8', label: 'SUMMER' },
  9: { bg: '#fff7ed', accent: '#f97316', label: 'AUTUMN' },
  10: { bg: '#fff7ed', accent: '#ea580c', label: 'AUTUMN' },
  11: { bg: '#fff7ed', accent: '#c2410c', label: 'AUTUMN' },
  12: { bg: '#f0f9ff', accent: '#6366f1', label: 'WINTER' },
};

const gridCardStyle: CSSProperties = {
  borderRadius: 14,
  overflow: 'hidden',
  background: 'white',
  border: '1px solid var(--color-border)',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  cursor: 'pointer',
  transition: 'transform 0.15s, box-shadow 0.15s',
};

const gridCardImageStyle: CSSProperties = {
  width: '100%',
  height: 110,
  objectFit: 'cover',
  display: 'block',
};

export default function SessionsPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('monthly');
  const [monthFilter, setMonthFilter] = useState(() => toMonthValue(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  const currentMonth = new Date().getMonth() + 1;

  const parseKeywordsInput = (value: string): string[] => {
    const seen = new Set<string>();
    const next: string[] = [];

    for (const token of value.split(',')) {
      const item = token.trim();
      if (!item) {
        continue;
      }
      const lower = item.toLowerCase();
      if (seen.has(lower)) {
        continue;
      }
      seen.add(lower);
      next.push(item);
      if (next.length >= 10) {
        break;
      }
    }

    return next;
  };

  const parsed = useMemo(() => parseMonth(monthFilter), [monthFilter]);

  const monthLabel = useMemo(() => {
    if (!parsed) {
      return '';
    }
    return monthFormatter.format(new Date(parsed.year, parsed.month - 1, 1));
  }, [parsed]);

  const defaultForMonth = useMemo(() => {
    if (!parsed) {
      return null;
    }
    return DEFAULT_SCHEDULES.find((schedule) => schedule.month === parsed.month) ?? null;
  }, [parsed]);

  const loadSessions = async (monthValue: string) => {
    const parsedValue = parseMonth(monthValue);
    if (!parsedValue) {
      setError('유효한 날짜를 선택해 주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await sessionsService.list({
        year: parsedValue.year,
        month: parsedValue.month,
      });
      setSessions(data);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      if (axiosError.response?.status === 401) {
        setError('로그인이 필요합니다. 로그인 화면으로 이동해 주세요.');
        navigate('/login');
      } else {
        setError(axiosError.response?.data?.detail || '일정을 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSessions(monthFilter);
  }, [monthFilter]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim() || !date) {
      setError('제목과 날짜를 입력해 주세요.');
      return;
    }

    const keywords = parseKeywordsInput(keywordsInput);

    setError(null);
    setIsSubmitting(true);

    try {
      await sessionsService.create({
        title: title.trim(),
        location: location.trim() || null,
        date,
        keywords,
      });

      setTitle('');
      setLocation('');
      setDate('');
      setKeywordsInput('');
      await loadSessions(monthFilter);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      if (axiosError.response?.status === 401) {
        setError('로그인이 필요합니다. 로그인 화면으로 이동해 주세요.');
        navigate('/login');
      } else {
        setError(axiosError.response?.data?.detail || '일정 등록에 실패했습니다. 입력값을 확인해 주세요.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGridCardClick = (month: number) => {
    setMonthFilter(`2026-${String(month).padStart(2, '0')}`);
    setViewMode('monthly');
  };

  return (
    <div className="story-page-shell">
      <PageHeader title="일정 관리" showBack onBack={() => navigate('/')} />

      <main className="story-content-container" style={{ paddingBottom: 32 }}>
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setViewMode('yearly')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              border: viewMode === 'yearly' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: viewMode === 'yearly' ? 'var(--color-primary)' : 'white',
              color: viewMode === 'yearly' ? 'white' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            2026 전체 일정
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            style={{
              flex: 1,
              padding: '10px 0',
              borderRadius: 10,
              border: viewMode === 'monthly' ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: viewMode === 'monthly' ? 'var(--color-primary)' : 'white',
              color: viewMode === 'monthly' ? 'white' : 'var(--color-text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            월별 보기
          </button>
        </div>

        {/* ===== YEARLY GRID VIEW ===== */}
        {viewMode === 'yearly' && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                2026년 연간 일정
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                3월 ~ 12월 · {DEFAULT_SCHEDULES.length}개
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 12,
              }}
            >
              {DEFAULT_SCHEDULES.map((schedule) => {
                const season = SEASON_COLORS[schedule.month];
                const isCurrent = schedule.month === currentMonth;
                return (
                  <div
                    key={schedule.month}
                    onClick={() => handleGridCardClick(schedule.month)}
                    style={{
                      ...gridCardStyle,
                      border: isCurrent ? `2px solid ${season.accent}` : '1px solid var(--color-border)',
                      position: 'relative',
                    }}
                  >
                    {/* Image */}
                    <div style={{ position: 'relative' }}>
                      <img
                        src={schedule.imageUrl}
                        alt={schedule.title}
                        style={gridCardImageStyle}
                        loading="lazy"
                      />
                      {/* Month badge */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          background: season.accent,
                          color: 'white',
                          borderRadius: 8,
                          padding: '3px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          letterSpacing: '0.02em',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                        }}
                      >
                        {schedule.month}월
                      </div>
                      {/* Current month indicator */}
                      {isCurrent && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: '#fff',
                            color: season.accent,
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            border: `1.5px solid ${season.accent}`,
                          }}
                        >
                          NOW
                        </div>
                      )}
                      {/* Season label overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                          padding: '16px 10px 6px',
                        }}
                      >
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em' }}>
                          {season.label}
                        </span>
                      </div>
                    </div>

                    {/* Card body */}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 6, lineHeight: 1.3 }}>
                        {schedule.title}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                        <span style={{ fontSize: '0.82rem' }}>📍</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                          {schedule.location}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                        <span style={{ fontSize: '0.82rem' }}>📅</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                          {formatDateKR(schedule.date)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {schedule.keywords.map((keyword) => (
                          <span
                            key={keyword}
                            style={{
                              display: 'inline-block',
                              padding: '1px 8px',
                              borderRadius: '999px',
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              background: season.bg,
                              color: season.accent,
                              border: `1px solid ${season.accent}30`,
                            }}
                          >
                            #{keyword}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== MONTHLY VIEW ===== */}
        {viewMode === 'monthly' && (
          <>
            <section className="story-surface-card" style={{ padding: 16, marginBottom: 16 }}>
              <p style={{ marginBottom: 8, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                월별로 일정을 조회하고, 추억 기록을 위한 추천 코스를 활용해 보세요.
              </p>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>조회 월</span>
                <input
                  aria-label="조회 월"
                  type="month"
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                  className="story-field"
                  style={{ background: '#FFFDFC' }}
                />
              </label>
            </section>

            {defaultForMonth && (
              <section style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, paddingLeft: 2 }}>
                  {parsed!.month}월 추천 일정
                </h2>

                <div style={cardStyle}>
                  <img
                    src={defaultForMonth.imageUrl}
                    alt={defaultForMonth.location}
                    style={cardImageStyle}
                    loading="lazy"
                  />
                  <div style={cardBodyStyle}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>
                      {defaultForMonth.title}
                    </h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                      {defaultForMonth.description}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.95rem' }}>📍</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', fontWeight: 600 }}>
                          {defaultForMonth.location}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.95rem' }}>📅</span>
                        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                          {formatDateKR(defaultForMonth.date)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {defaultForMonth.keywords.map((keyword) => (
                        <span key={keyword} style={tagStyle}>
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="story-surface-card" style={{ padding: 16, marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: 10 }}>일정 등록</h2>
              <form onSubmit={onSubmit} style={{ display: 'grid', gap: 10 }}>
                <input
                  aria-label="일정 제목"
                  placeholder="예: 4월 주말 한강 산책"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={255}
                  className="story-field"
                />
                <input
                  aria-label="위치"
                  placeholder="예: 한강 공원"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  maxLength={255}
                  className="story-field"
                />
                <input
                  aria-label="날짜"
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="story-field"
                />
                <input
                  aria-label="키워드"
                  placeholder="예: 공원, 산책, 아이와"
                  value={keywordsInput}
                  onChange={(event) => setKeywordsInput(event.target.value)}
                  maxLength={255}
                  className="story-field"
                />
                <PrimaryButton type="submit" disabled={isSubmitting} size="md" fullWidth className="story-cta-with-icon">
                  <span className="story-icon-3d story-icon-3d-sm" aria-hidden="true">
                    <span className="story-icon-emoji">＋</span>
                  </span>
                  <span>{isSubmitting ? '저장 중...' : '일정 등록'}</span>
                </PrimaryButton>
              </form>
            </section>

            <section className="story-surface-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{monthLabel} 일정 목록</h2>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{sessions.length}개</span>
              </div>

              {error && (
                <p style={{ color: '#B33A3A', marginBottom: 8, fontSize: '0.9rem' }} role="alert">
                  {error}
                </p>
              )}

              {isLoading ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>일정을 불러오는 중입니다.</p>
              ) : sessions.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>해당 월에 등록된 일정이 없습니다.</p>
              ) : (
                <ul style={{ display: 'grid', gap: 10, padding: 0, margin: 0, listStyle: 'none' }}>
                  {sessions.map((session) => (
                    <li
                      key={session.id}
                      style={{
                        borderRadius: 'var(--radius-xl)',
                        padding: 12,
                        background: 'var(--color-bg-soft)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 2 }}>{session.title}</p>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: 2 }}>
                        📍 {session.location || '위치 미기입'}
                      </p>
                      <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginBottom: 4 }}>📅 {session.date}</p>
                      {session.keywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {session.keywords.map((keyword) => (
                            <span
                              key={keyword}
                              style={{
                                ...tagStyle,
                                fontSize: '0.72rem',
                                padding: '1px 8px',
                              }}
                            >
                              #{keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
