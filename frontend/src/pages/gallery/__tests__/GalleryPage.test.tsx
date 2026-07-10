import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import GalleryPage from '../index';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { Photo } from '@/types/photo';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const photos: Photo[] = [
  {
    id: 'photo-1',
    user_id: 'user-1',
    session_id: 'session-1',
    original_url: 'https://cdn.example.com/original.jpg',
    edited_url: 'https://cdn.example.com/edited.jpg',
    thumbnail_url: 'https://cdn.example.com/thumb.jpg',
    title: '봄 소풍',
    topic: '봄',
    content: null,
    music_url: null,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
  },
];

function renderPage(entry = '/gallery') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <GalleryPage />
    </MemoryRouter>,
  );
}

describe('GalleryPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    useAuthStore.setState({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        name: '사용자',
        role: 'student',
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('shows a loading state while photos are requested', () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
  });

  it('loads the current user gallery and opens a photo detail', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: photos, next_offset: null } });
    renderPage();

    expect(await screen.findByRole('heading', { name: '보관함' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/v1/photos/page', {
      params: { offset: 0, limit: 24 },
    });
    expect(screen.getByRole('img', { name: '봄 소풍' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/thumb.jpg',
    );

    await user.click(screen.getByRole('button', { name: '사진 상세 보기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/gallery/photo-1');
  });

  it('offers camera capture when the gallery is empty', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [], next_offset: null } });
    renderPage();

    expect(await screen.findByText('기록된 사진이 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '사진 촬영하기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/camera');
  });

  it('shows a retry action when both server and local storage are empty', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: { items: photos, next_offset: null } });
    renderPage();

    expect(await screen.findByText('불러온 사진이 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다시 가져오기' }));

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('img', { name: '봄 소풍' })).toBeInTheDocument();
  });

  it('hides delete controls from a parent account', async () => {
    useAuthStore.setState({
      user: {
        ...useAuthStore.getState().user!,
        role: 'parent',
      },
    });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: photos, next_offset: null } });
    renderPage();

    expect(await screen.findByRole('heading', { name: '사진 보기' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '삭제' })).not.toBeInTheDocument();
  });

  it('loads the next page without duplicating existing photos', async () => {
    const user = userEvent.setup();
    const secondPhoto = { ...photos[0], id: 'photo-2', title: '여름 소풍' };
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: { items: photos, next_offset: 24 } })
      .mockResolvedValueOnce({ data: { items: [secondPhoto], next_offset: null } });
    renderPage();

    await user.click(await screen.findByRole('button', { name: '사진 더 보기' }));

    expect(await screen.findByRole('img', { name: '여름 소풍' })).toBeInTheDocument();
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/photos/page', {
      params: { offset: 24, limit: 24 },
    });
  });

  it('returns a selected gallery photo to the chosen retouch card', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { items: photos, next_offset: null },
    });
    renderPage('/gallery?selectFor=retouch&templateId=retouch-7');

    await user.click(await screen.findByRole('button', { name: '이 사진 선택' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      '/ai-retouch?sourcePhotoId=photo-1&templateId=retouch-7',
    );
  });
});
