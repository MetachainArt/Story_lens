import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

import PageHeader from '@/components/common/PageHeader';
import sessionsService from '@/services/sessions';
import type { Session } from '@/types/session';

const monthFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
});

function toMonthValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseMonth(value: string): { year: number; month: number } | null {
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const [monthFilter, setMonthFilter] = useState(() => toMonthValue(new Date()));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');

  const parseKeywordsInput = (value: string): string[] => {
    const seen = new Set<string>();
    const parsed: string[] = [];

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
      parsed.push(item);
      if (parsed.length >= 10) {
        break;
      }
    }

    return parsed;
  };

  const monthLabel = useMemo(() => {
    const parsed = parseMonth(monthFilter);
    if (!parsed) {
      return '';
    }
    return monthFormatter.format(new Date(parsed.year, parsed.month - 1, 1));
  }, [monthFilter]);

  const loadSessions = async (monthValue: string) => {
    const parsed = parseMonth(monthValue);
    if (!parsed) {
      setError('월 형식이 올바르지 않아요.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await sessionsService.list({
        year: parsed.year,
        month: parsed.month,
      });
      setSessions(data);
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      if (axiosError.response?.status === 401) {
        setError('로그인이 만료되었어요. 다시 로그인해 주세요.');
        navigate('/login');
      } else {
        setError(
          axiosError.response?.data?.detail ||
            '일정을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions(monthFilter);
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
    } catch (error) {
      const axiosError = error as AxiosError<{ detail?: string }>;
      if (axiosError.response?.status === 401) {
        setError('로그인이 필요해요. 다시 로그인해 주세요.');
        navigate('/login');
      } else {
        setError(
          axiosError.response?.data?.detail ||
            '일정을 저장하지 못했어요. 입력값을 확인해 주세요.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FFF5EB 0%, #FCEBD5 100%)' }}>
      <PageHeader title="촬영 일정" showBack onBack={() => navigate('/')} />

      <main style={{ padding: '20px 16px 28px', maxWidth: 760, margin: '0 auto' }}>
        <section
          style={{
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <p style={{ marginBottom: '8px', color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            매달 방문 장소를 확인하고 촬영 계획을 미리 기록해요.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>조회 월</span>
            <input
              aria-label="조회 월"
              type="month"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              style={{
                height: 44,
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--color-border)',
                padding: '0 12px',
                fontSize: '1rem',
                background: '#FFFDFC',
              }}
            />
          </label>
        </section>

        <section
          style={{
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '10px' }}>새 일정 추가</h2>
          <form onSubmit={onSubmit} style={{ display: 'grid', gap: '10px' }}>
            <input
              aria-label="일정 제목"
              placeholder="예: 4월 공원 봄꽃 촬영"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              style={{
                height: 44,
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--color-border)',
                padding: '0 12px',
                fontSize: '1rem',
              }}
            />
            <input
              aria-label="장소"
              placeholder="예: 서울숲"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={255}
              style={{
                height: 44,
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--color-border)',
                padding: '0 12px',
                fontSize: '1rem',
              }}
            />
            <input
              aria-label="날짜"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              style={{
                height: 44,
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--color-border)',
                padding: '0 12px',
                fontSize: '1rem',
              }}
            />
            <input
              aria-label="주제 키워드"
              placeholder="예: 봄꽃, 산책, 미소 (쉼표로 구분)"
              value={keywordsInput}
              onChange={(event) => setKeywordsInput(event.target.value)}
              maxLength={255}
              style={{
                height: 44,
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid var(--color-border)',
                padding: '0 12px',
                fontSize: '1rem',
              }}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                height: 48,
                borderRadius: 'var(--radius-2xl)',
                border: '2px solid rgba(255,255,255,0.2)',
                background: 'linear-gradient(135deg, #D4845A 0%, #C47550 100%)',
                color: '#FFF8F0',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
              }}
            >
              {isSubmitting ? '저장 중...' : '일정 저장'}
            </button>
          </form>
        </section>

        <section
          style={{
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            boxShadow: 'var(--shadow-sm)',
            padding: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{monthLabel} 일정</h2>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{sessions.length}개</span>
          </div>

          {error && (
            <p style={{ color: '#B33A3A', marginBottom: '8px', fontSize: '0.9rem' }} role="alert">
              {error}
            </p>
          )}

          {isLoading ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>일정을 불러오는 중...</p>
          ) : sessions.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>아직 등록된 일정이 없어요.</p>
          ) : (
            <ul style={{ display: 'grid', gap: '10px', padding: 0, margin: 0, listStyle: 'none' }}>
              {sessions.map((session) => (
                <li
                  key={session.id}
                  style={{
                    border: '1px dashed var(--color-border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '12px',
                    background: 'var(--color-bg-soft)',
                  }}
                >
                  <p style={{ fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>{session.title}</p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem', marginBottom: '2px' }}>
                    장소: {session.location || '장소 미정'}
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>날짜: {session.date}</p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
                    주제: {session.keywords.length > 0 ? session.keywords.join(', ') : '아직 없음'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
