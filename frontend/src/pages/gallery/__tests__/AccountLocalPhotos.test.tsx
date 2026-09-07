import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GalleryPage from '../index';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

beforeEach(() => {
  const photos = JSON.stringify([{ id: 'local-private-a', edited_url: 'data:image/jpeg;base64,AAAA', topic: 'A의 비공개 사진', created_at: '2026-09-07' }]);
  vi.mocked(localStorage.getItem).mockImplementation(key => ['saved_photos', 'user:a:saved_photos'].includes(key) ? photos : null);
  vi.mocked(api.get).mockRejectedValue(new Error('offline'));
});

it('keeps A photos out of B gallery even when the server is unavailable', async () => {
  useAuthStore.setState({ user: { id: 'a' } as never });
  const view = render(<MemoryRouter><GalleryPage /></MemoryRouter>);
  expect(await screen.findByAltText('사진')).toHaveAttribute('src', 'data:image/jpeg;base64,AAAA');
  view.unmount();
  useAuthStore.setState({ user: { id: 'b' } as never });
  render(<MemoryRouter><GalleryPage /></MemoryRouter>);
  expect(await screen.findByText('불러온 사진이 없어요')).toBeInTheDocument();
  expect(screen.queryByAltText('사진')).not.toBeInTheDocument();
  expect(localStorage.removeItem).not.toHaveBeenCalledWith('saved_photos');
});
