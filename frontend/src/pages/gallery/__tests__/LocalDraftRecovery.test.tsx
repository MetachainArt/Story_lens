import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import GalleryDetailPage from '../detail';
import api from '@/services/api';
import { useAuthStore } from '@/stores/auth';

vi.mock('@/services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));

describe('pending draft recovery', () => {
  let records: Record<string, string>;
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: { id: 'user-a' } as never });
    vi.mocked(api.get).mockResolvedValue({ data: {
      id: 'photo-1', original_url: 'data:image/jpeg;base64,AAAA', content: '기존 서버 글',
      created_at: '2026-01-01', updated_at: '2026-01-01',
    } });
    records = { 'user:user-a:story_drafts': JSON.stringify([{
        id: 'draft-1', photoId: 'photo-1', content: '새로 수정한 글', topic: '',
        created_at: '2026-09-07', pending: true,
      }]) };
    vi.mocked(localStorage.getItem).mockImplementation(key => records[key] ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => { records[key] = value; });
  });

  it('shows the pending local edit over stale server content and allows retry', async () => {
    render(<MemoryRouter initialEntries={['/gallery/photo-1']}><Routes>
      <Route path="/gallery/:photoId" element={<GalleryDetailPage />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('새로 수정한 글')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '서버 저장 다시 시도' })).toBeInTheDocument();
    vi.mocked(api.put).mockRejectedValueOnce(new Error('offline'));
    await userEvent.click(screen.getByRole('button', { name: '서버 저장 다시 시도' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이 기기의 수정 글은 그대로');
    expect(JSON.parse(records['user:user-a:story_drafts'])).toHaveLength(1);
    vi.mocked(api.put).mockResolvedValueOnce({ data: {} });
    await userEvent.click(screen.getByRole('button', { name: '서버 저장 다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '서버 저장 다시 시도' })).not.toBeInTheDocument());
    expect(api.put).toHaveBeenLastCalledWith('/api/v1/photos/photo-1', { content: '새로 수정한 글' });
    expect(JSON.parse(records['user:user-a:story_drafts'])).toHaveLength(0);
    expect(screen.getByText('새로 수정한 글')).toBeInTheDocument();
  });
});
