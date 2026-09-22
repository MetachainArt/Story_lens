import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SessionsPage from '../index';
import api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: { items: [], next_offset: null } });
  });

  it('loads monthly photos on first render', async () => {
    const now = new Date();
    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/v1/photos/page', {
        params: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          offset: 0,
          limit: 50,
        },
      });
    });
  });

  it('loads later pages and resolves private thumbnails', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [{ id: 'first', original_url: '/uploads/photos/u/first.jpg', topic: '첫 사진' }], next_offset: 50 } });
    vi.mocked(api.get).mockResolvedValueOnce({ data: { items: [{ id: 'last', original_url: '/uploads/photos/u/last.jpg', topic: '마지막 사진' }], next_offset: null } });
    render(<MemoryRouter><SessionsPage /></MemoryRouter>);
    expect(await screen.findByAltText('마지막 사진')).toHaveAttribute('src', expect.stringContaining('/api/v1/media/uploads/photos/u/last.jpg'));
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(api.get).toHaveBeenLastCalledWith('/api/v1/photos/page', { params: expect.objectContaining({ offset: 50 }) });
  });
});
