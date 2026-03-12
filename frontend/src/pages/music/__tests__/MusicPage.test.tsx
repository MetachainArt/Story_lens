import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import MusicPage from '../index';
import api from '@/services/api';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
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

describe('MusicPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.post).mockResolvedValue({ data: { task_id: 'task-1' } });
    vi.mocked(api.get).mockResolvedValue({ data: { status: 'PENDING' } });
  });

  it('renders genre-style options for music generation', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/music/photo-1', state: { topic: '사랑' } }]}>
        <Routes>
          <Route path="/music/:photoId" element={<MusicPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /발라드/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /재즈/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /힙합/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /인디 팝/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로파이/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /어쿠스틱 포크/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /클래식/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /시네마틱/ })).toBeInTheDocument();
  });

  it('sends the selected style when requesting music generation', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{ pathname: '/music/photo-1', state: { topic: '사랑', draftText: '봄빛이 천천히 번져와' } }]}>
        <Routes>
          <Route path="/music/:photoId" element={<MusicPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /재즈/ }));
    await user.click(screen.getByRole('button', { name: 'AI 음악 만들기' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/v1/music/generate', {
        topic: '사랑',
        style: '재즈',
        mood: '재즈',
        draft_text: '봄빛이 천천히 번져와',
        photo_id: 'photo-1',
      });
    });
  });
});
