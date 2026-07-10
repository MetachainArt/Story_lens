import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GalleryPage from '../index';
import api from '@/services/api';
import type { Photo } from '@/types/photo';

vi.mock('@/services/api');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const photo: Photo = {
  id: 'photo-delete-1',
  user_id: 'user-1',
  session_id: 'session-1',
  original_url: '/uploads/photos/user-1/original.jpg',
  edited_url: null,
  title: '삭제 테스트 사진',
  thumbnail_url: null,
  content: null,
  music_url: null,
  topic: null,
  created_at: '2026-06-13T08:00:00Z',
  updated_at: '2026-06-13T08:00:00Z',
};

describe('GalleryPage delete persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    localStorage.clear();
  });

  it('keeps the photo visible when the server delete request fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [photo], next_offset: null } });
    vi.mocked(api.delete).mockRejectedValueOnce(new Error('network down'));

    render(
      <BrowserRouter>
        <GalleryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByAltText('삭제 테스트 사진')).toBeInTheDocument();

    await user.click(screen.getByLabelText('삭제'));
    const dialog = screen.getByRole('dialog', { name: '사진 삭제' });
    await user.click(within(dialog).getByRole('button', { name: /^삭제$/ }));

    expect(api.delete).toHaveBeenCalledWith('/api/v1/photos/photo-delete-1');
    expect(await screen.findByAltText('삭제 테스트 사진')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('사진을 삭제하지 못했어요');
  });

  it('removes the photo and matching local fallback only after delete succeeds', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'saved_photos',
      JSON.stringify([
        {
          id: photo.id,
          edited_url: 'data:image/jpeg;base64,AAAA',
          topic: null,
          created_at: photo.created_at,
        },
      ]),
    );
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [photo], next_offset: null } });
    vi.mocked(api.delete).mockResolvedValueOnce({ data: undefined });

    render(
      <BrowserRouter>
        <GalleryPage />
      </BrowserRouter>,
    );

    expect(await screen.findByAltText('삭제 테스트 사진')).toBeInTheDocument();

    await user.click(screen.getByLabelText('삭제'));
    const dialog = screen.getByRole('dialog', { name: '사진 삭제' });
    await user.click(within(dialog).getByRole('button', { name: /^삭제$/ }));

    await waitFor(() => {
      expect(screen.queryByAltText('삭제 테스트 사진')).not.toBeInTheDocument();
    });
    expect(api.delete).toHaveBeenCalledWith('/api/v1/photos/photo-delete-1');
    expect(localStorage.getItem('saved_photos') || '[]').toBe('[]');
  });
});
