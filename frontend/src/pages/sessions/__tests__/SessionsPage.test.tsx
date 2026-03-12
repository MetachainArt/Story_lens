import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
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
    vi.mocked(api.get).mockResolvedValue({ data: [] });
  });

  it('loads monthly photos on first render', async () => {
    const now = new Date();
    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/api/v1/photos', {
        params: {
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        },
      });
    });
  });
});
