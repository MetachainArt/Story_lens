import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import WritePage from '../index';
import api from '@/services/api';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('WritePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['image-bytes'], { type: 'image/jpeg' }),
      }),
    );
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    (localStorage.getItem as unknown as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'story_drafts') {
        return '[]';
      }
      return null;
    });
  });

  it('renders the selected photo and both writing modes', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/write/photo-1',
            state: { photoId: 'photo-1', topic: '용기', imageUrl: 'data:image/jpeg;base64,x' },
          },
        ]}
      >
        <Routes>
          <Route path="/write/:photoId" element={<WritePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByAltText('사진')).toHaveAttribute('src', 'data:image/jpeg;base64,x');
    expect(screen.getByRole('button', { name: '💬 대화로 쓰기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '✏️ 혼자 쓰기' })).toBeInTheDocument();
  });

  it('saves draft and goes home', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/write/photo-1',
            state: { photoId: 'photo-1', topic: '용기' },
          },
        ]}
      >
        <Routes>
          <Route path="/write/:photoId" element={<WritePage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.type(screen.getByLabelText('작성 본문'), '오늘은 용기를 내서 웃어봤다.');
    await user.click(screen.getByRole('button', { name: '문장 저장' }));

    expect(api.put).toHaveBeenCalledWith('/api/v1/photos/photo-1', {
      content: '오늘은 용기를 내서 웃어봤다.',
    });
    expect(mockNavigate).toHaveBeenCalledWith('/gallery/photo-1');
  });

  it('uploads a local photo before requesting Gemini draft generation', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post)
      .mockResolvedValueOnce({ data: { id: 'photo-server-1' } })
      .mockResolvedValueOnce({ data: { draft: '제미나이 초안', source: 'gemini' } });

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/write/local-1',
            state: { photoId: 'local-1', topic: '용기', imageUrl: 'data:image/jpeg;base64,x' },
          },
        ]}
      >
        <Routes>
          <Route path="/write/:photoId" element={<WritePage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: '✏️ 혼자 쓰기' }));
    await user.click(screen.getByRole('button', { name: 'AI 글 생성' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenNthCalledWith(
        1,
        '/api/v1/photos',
        expect.any(FormData),
      );
    });

    expect(api.post).toHaveBeenNthCalledWith(2, '/api/v1/photos/photo-server-1/generate-draft', {
      topic: '용기',
      keywords: [],
      tone: '에세이',
      current_text: '',
    });
    expect(global.fetch).toHaveBeenCalledWith('data:image/jpeg;base64,x', { credentials: 'include' });
    expect(await screen.findByDisplayValue('제미나이 초안')).toBeInTheDocument();
    expect(screen.getByText('Gemini로 최대 5줄 초안을 만들었어요. 마음에 드는 부분을 이어 써보세요.')).toBeInTheDocument();
  });
});
