import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';

import PageHeader from '@/components/common/PageHeader';
import { SecondaryButton } from '@/components/common/Button';
import api from '@/services/api';
import type { Photo } from '@/types/photo';

type ViewMode = 'monthly' | 'yearly';

interface Mission {
  id: number;
  title: string;
  description: string;
}

interface DefaultSchedule {
  month: number;
  title: string;
  location: string;
  description: string;
  date: string;
  imageUrl: string;
  keywords: string[];
  missions?: Mission[];
  myTopic?: string;
  myStory?: string;
}

const DEFAULT_SCHEDULES: DefaultSchedule[] = [
  {
    month: 3,
    title: '오리엔테이션 & 기초 교육',
    location: '설봉공원 (설봉역)',
    description: '사진 촬영에 대한 기초 교육을 진행합니다. 설봉공원에서 첫 만남!',
    date: '2026-03-15',
    imageUrl: 'https://images.unsplash.com/photo-1722501569916-cbec540b8a98?w=800&h=400&fit=crop&q=80',
    keywords: ['오리엔테이션', '기초교육', '설봉공원'],
    missions: [
      { id: 1, title: '설봉역을 찾아라!', description: '사진 속의 모습을 찾아라! 설봉공원 안에 숨어있는 설봉역을 찾아 사진을 찍어보세요.' },
      { id: 2, title: '사진에 보이는 글자를 찾아라!', description: '공원 곳곳에 숨어있는 글자를 찾아 사진으로 기록해보세요.' },
    ],
    myTopic: '나를 소개하는 사진 한 장 찍기 — 설봉공원에서 "나"를 가장 잘 표현하는 장면을 찾아보세요.',
    myStory: '오늘 처음 만난 친구들과 설봉공원을 걸으며 느낀 점을 자유롭게 적어보세요. 어떤 장면이 가장 기억에 남나요?',
  },
  {
    month: 4,
    title: '봄꽃 출사',
    location: '양평 벚꽃길',
    description: '양평 벚꽃길에서 활짝 핀 봄꽃을 카메라에 담아보세요.',
    date: '2026-04-11',
    imageUrl: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&h=400&fit=crop&q=80',
    keywords: ['꽃', '벚꽃', '양평'],
    missions: [
      { id: 1, title: '가장 예쁜 벚꽃 한 송이 찍기', description: '나만의 시선으로 가장 아름다운 벚꽃 한 송이를 클로즈업해 보세요.' },
      { id: 2, title: '벚꽃길 전체를 담아라!', description: '벚꽃이 가득한 길을 한 장의 사진으로 담아보세요. 원근감을 살려보세요.' },
    ],
    myTopic: '봄하면 떠오르는 것 — 벚꽃, 따뜻한 바람, 새싹... 나에게 "봄"이란 어떤 의미인가요?',
    myStory: '벚꽃길을 걸으며 떠오른 생각이나 추억을 적어보세요. 봄이 오면 꼭 하고 싶은 일이 있나요?',
  },
  {
    month: 5,
    title: '풍경 사진',
    location: '임진각',
    description: '역사와 자연이 어우러진 임진각에서 풍경 사진을 찍어봅니다.',
    date: '2026-05-09',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=400&fit=crop&q=80',
    keywords: ['풍경', '임진각', '역사'],
    missions: [
      { id: 1, title: '평화의 상징 찾기', description: '임진각에서 "평화"를 상징하는 장면이나 물건을 찾아 사진으로 남겨보세요.' },
      { id: 2, title: '하늘과 땅이 만나는 풍경', description: '넓은 하늘과 땅이 만나는 수평선을 찾아 멋진 풍경 사진을 찍어보세요.' },
    ],
    myTopic: '내가 지키고 싶은 것 — 임진각에서 "평화"를 느끼며 나에게 소중한 것은 무엇인지 생각해 보세요.',
    myStory: '임진각에서 본 풍경 중 가장 마음에 남는 장면을 골라, 그 사진에 담긴 나의 이야기를 써보세요.',
  },
  {
    month: 6,
    title: '계곡 출사',
    location: '계곡',
    description: '시원한 계곡에서 물과 자연의 풍경을 카메라에 담아보세요.',
    date: '2026-06-13',
    imageUrl: 'https://images.unsplash.com/photo-1670735411734-c9725326de3f?w=800&h=400&fit=crop&q=80',
    keywords: ['계곡', '자연', '여름'],
    missions: [
      { id: 1, title: '물의 움직임을 잡아라!', description: '흐르는 물, 물보라, 물방울... 물의 다양한 모습을 사진으로 담아보세요.' },
      { id: 2, title: '계곡 속 숨은 생명 찾기', description: '계곡에 사는 작은 생물이나 식물을 찾아 가까이서 찍어보세요.' },
    ],
    myTopic: '시원함의 순간 — 더운 날 계곡 물에 발을 담갔을 때의 느낌, "시원하다"는 나에게 어떤 감정인가요?',
    myStory: '계곡에서 보낸 하루를 떠올리며, 물소리와 함께 느낀 감정을 자유롭게 적어보세요.',
  },
  {
    month: 7,
    title: '바다 출사',
    location: '방아머리 해수욕장',
    description: '방아머리 해수욕장에서 시원한 바다와 여름을 사진으로 담아봅니다.',
    date: '2026-07-11',
    imageUrl: 'https://images.unsplash.com/photo-1647767459550-1e35617029ec?w=800&h=400&fit=crop&q=80',
    keywords: ['바다', '해수욕장', '여름'],
    missions: [
      { id: 1, title: '파도의 순간 포착!', description: '밀려오는 파도가 부서지는 순간을 사진으로 잡아보세요. 타이밍이 중요해요!' },
      { id: 2, title: '모래 위의 발자국', description: '모래 위에 나만의 발자국을 남기고 사진을 찍어보세요. 예쁜 구도를 찾아봐요.' },
    ],
    myTopic: '바다에게 하고 싶은 말 — 넓은 바다를 보면 어떤 기분이 드나요? 바다에게 편지를 쓴다면?',
    myStory: '파도 소리를 들으며 바다에서 보낸 시간을 떠올려 보세요. 가장 재미있었던 순간은 무엇인가요?',
  },
  {
    month: 8,
    title: '무더위 휴식',
    location: '휴식',
    description: '무더운 여름, 잠시 쉬어가는 시간입니다. 재충전하고 돌아와요!',
    date: '2026-08-01',
    imageUrl: 'https://images.unsplash.com/photo-1688544994167-79cf8c9e5b29?w=800&h=400&fit=crop&q=80',
    keywords: ['휴식', '여름', '재충전'],
    missions: [
      { id: 1, title: '집에서 찍는 일상 사진', description: '집이나 동네에서 보이는 여름 풍경을 한 장 찍어보세요. 선풍기, 수박, 빙수 다 좋아요!' },
      { id: 2, title: '나만의 쉼터 소개하기', description: '내가 가장 편안하게 쉴 수 있는 장소를 사진으로 찍고 소개해 보세요.' },
    ],
    myTopic: '나의 쉼 — 쉬는 날 가장 좋아하는 일은 무엇인가요? 나만의 재충전 방법을 사진으로 표현해 보세요.',
    myStory: '올 여름 가장 기억에 남는 순간을 하나 골라 이야기해 보세요. 어떤 점이 특별했나요?',
  },
  {
    month: 9,
    title: '캠핑 출사',
    location: '캠핑장',
    description: '캠핑장에서 자연과 함께하는 시간을 사진으로 기록해보세요.',
    date: '2026-09-12',
    imageUrl: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=400&fit=crop&q=80',
    keywords: ['캠핑', '자연', '가을'],
    missions: [
      { id: 1, title: '텐트와 자연이 어우러진 사진', description: '텐트와 주변 자연이 함께 담긴 멋진 풍경 사진을 찍어보세요.' },
      { id: 2, title: '캠핑 음식 사진 찍기', description: '캠핑에서 먹는 맛있는 음식을 예쁘게 찍어보세요. 음식 사진의 포인트를 찾아봐요!' },
    ],
    myTopic: '자연 속의 나 — 도시를 벗어나 자연 속에 있으면 어떤 기분이 드나요? 자연에서 가장 좋아하는 것은?',
    myStory: '캠핑장에서의 하루를 일기처럼 적어보세요. 특별했던 소리, 냄새, 맛이 있었나요?',
  },
  {
    month: 10,
    title: '전통 사진',
    location: '용인 민속촌',
    description: '한국 전통 문화가 살아있는 용인 민속촌에서 전통 사진을 찍어봅니다.',
    date: '2026-10-10',
    imageUrl: 'https://images.unsplash.com/photo-1697171796903-74f6a1367ba2?w=800&h=400&fit=crop&q=80',
    keywords: ['전통', '민속촌', '문화'],
    missions: [
      { id: 1, title: '전통 가옥의 아름다움 담기', description: '한옥의 지붕, 문, 담장 등 전통 건축의 아름다운 부분을 찾아 사진에 담아보세요.' },
      { id: 2, title: '옛날 사람들의 생활 도구 찾기', description: '민속촌에서 옛날 사람들이 쓰던 도구나 물건을 찾아 사진으로 기록해 보세요.' },
    ],
    myTopic: '나에게 "전통"이란 — 한복, 한옥, 떡... 전통하면 떠오르는 것 중 내가 가장 좋아하는 것은 무엇인가요?',
    myStory: '민속촌을 둘러보며 가장 신기했거나 재미있었던 것을 골라 이야기해 보세요. 옛날에 살았다면 어떤 기분이었을까요?',
  },
  {
    month: 11,
    title: '사진 A.I 활용',
    location: '이천시장애인종합복지관',
    description: 'AI를 활용한 사진 편집과 글쓰기를 배워봅니다.',
    date: '2026-11-14',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop&q=80',
    keywords: ['AI', '사진편집', '글쓰기'],
    missions: [
      { id: 1, title: 'AI로 내 사진 편집하기', description: 'Story Lens의 AI 편집 기능을 사용해 내가 찍은 사진을 멋지게 꾸며보세요.' },
      { id: 2, title: 'AI와 함께 글쓰기', description: 'AI의 도움을 받아 내 사진에 어울리는 짧은 글(캡션)을 써보세요.' },
    ],
    myTopic: 'AI와 나 — AI가 도와주는 사진 편집과 글쓰기, 어떤 점이 신기하고 어떤 점이 아쉬운가요?',
    myStory: 'AI와 함께 만든 작품(사진+글)을 소개하고, 만드는 과정에서 느낀 점을 적어보세요.',
  },
  {
    month: 12,
    title: '한 해의 마무리',
    location: '이천시장애인종합복지관',
    description: '한 해 동안의 활동을 되돌아보며 마무리합니다. 수고하셨습니다!',
    date: '2026-12-12',
    imageUrl: 'https://images.unsplash.com/photo-1543589077-47d81606c1bf?w=800&h=400&fit=crop&q=80',
    keywords: ['마무리', '전시', '회고'],
    missions: [
      { id: 1, title: '올해 최고의 사진 한 장 고르기', description: '1년 동안 찍은 사진 중 가장 마음에 드는 사진 한 장을 골라보세요.' },
      { id: 2, title: '친구에게 사진 선물하기', description: '함께 활동한 친구가 찍힌 사진을 골라 선물해 보세요.' },
    ],
    myTopic: '나의 한 해 — 올 한 해 사진 활동을 통해 가장 성장한 점은 무엇인가요? 내년에 찍고 싶은 사진은?',
    myStory: '3월부터 12월까지의 여정을 돌아보며, 나에게 가장 특별했던 순간과 그 이유를 이야기해 보세요.',
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1;


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

  const loadPhotos = useCallback(async (monthValue: string) => {
    const parsedValue = parseMonth(monthValue);
    if (!parsedValue) {
      setError('유효한 날짜를 선택해 주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get('/api/v1/photos', {
        params: {
          year: parsedValue.year,
          month: parsedValue.month,
        },
      });
      setPhotos(response.data);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      if (axiosError.response?.status === 401) {
        setError('로그인이 필요합니다. 로그인 화면으로 이동해 주세요.');
        navigate('/login');
      } else {
        setError(axiosError.response?.data?.detail || '사진을 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPhotos(monthFilter);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadPhotos, monthFilter]);


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
                        <span key={keyword} style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: 'var(--color-bg-soft)',
                          color: 'var(--color-text-secondary)',
                          border: '1px solid var(--color-border)',
                        }}>
                          #{keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Missions */}
            {defaultForMonth?.missions && defaultForMonth.missions.length > 0 && (
              <section style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, paddingLeft: 2 }}>
                  {parsed!.month}월의 미션
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {defaultForMonth.missions.map((mission) => {
                    const season = SEASON_COLORS[parsed!.month];
                    return (
                      <div
                        key={mission.id}
                        style={{
                          borderRadius: 'var(--radius-2xl)',
                          padding: '14px 16px',
                          background: season?.bg || '#f9fafb',
                          border: `1.5px solid ${season?.accent || 'var(--color-border)'}30`,
                          display: 'flex',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            background: season?.accent || 'var(--color-primary)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {mission.id}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                            {mission.title}
                          </p>
                          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                            {mission.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 나의 주제 & 나의 이야기 */}
            {defaultForMonth && (defaultForMonth.myTopic || defaultForMonth.myStory) && (
              <section style={{ marginBottom: 16 }}>
                {defaultForMonth.myTopic && (
                  <div style={{ marginBottom: defaultForMonth.myStory ? 12 : 0 }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, paddingLeft: 2 }}>
                      나의 주제
                    </h2>
                    <div
                      style={{
                        borderRadius: 'var(--radius-2xl)',
                        padding: '16px 18px',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '1.5px solid #f59e0b40',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: '#f59e0b',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        ?
                      </div>
                      <p style={{ fontSize: '0.92rem', color: '#78350f', lineHeight: 1.6, fontWeight: 500 }}>
                        {defaultForMonth.myTopic}
                      </p>
                    </div>
                  </div>
                )}

                {defaultForMonth.myStory && (
                  <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 10, paddingLeft: 2 }}>
                      나의 이야기
                    </h2>
                    <div
                      style={{
                        borderRadius: 'var(--radius-2xl)',
                        padding: '16px 18px',
                        background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
                        border: '1.5px solid #8b5cf640',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          background: '#8b5cf6',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.2rem',
                          flexShrink: 0,
                          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
                        }}
                      >
                        &#9997;
                      </div>
                      <p style={{ fontSize: '0.92rem', color: '#4c1d95', lineHeight: 1.6, fontWeight: 500 }}>
                        {defaultForMonth.myStory}
                      </p>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="story-surface-card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{monthLabel} 나의 시선</h2>
                <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{photos.length}장</span>
              </div>

              {error && (
                <p style={{ color: '#B33A3A', marginBottom: 8, fontSize: '0.9rem' }} role="alert">
                  {error}
                </p>
              )}

              {isLoading ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>사진을 불러오는 중입니다.</p>
              ) : photos.length === 0 ? (
                <p style={{ color: 'var(--color-text-secondary)' }}>해당 월에 저장된 사진이 없습니다.</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {photos.map((photo) => {
                    const imageUrl = photo.thumbnail_url || photo.edited_url || photo.original_url;
                    return (
                      <div
                        key={photo.id}
                        onClick={() => navigate(`/gallery/${photo.id}`)}
                        style={{
                          aspectRatio: '1/1',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: 'var(--color-bg-soft)',
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                      >
                        <img
                          src={imageUrl.startsWith('/') ? `${import.meta.env.VITE_API_URL || ''}${imageUrl}` : imageUrl}
                          alt={photo.topic || '사진'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                        {photo.topic && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                              padding: '12px 6px 4px',
                            }}
                          >
                            <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 600, display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                              #{photo.topic}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
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
