import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import SessionsPage from '../index';
import sessionsService from '@/services/sessions';

vi.mock('@/services/sessions', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
  },
}));

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(sessionsService.list).mockResolvedValue([]);
    vi.mocked(sessionsService.create).mockResolvedValue({
      id: 'session-1',
      user_id: 'user-1',
      title: '3월 공원 촬영',
      date: '2026-03-15',
      location: '서울숲',
      keywords: ['봄꽃'],
      created_at: '2026-03-10T12:00:00Z',
    });
  });

  it('loads monthly sessions on first render', async () => {
    const now = new Date();
    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalledWith({
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      });
    });
  });

  it('creates a session and refreshes the same month list', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SessionsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText('일정 제목'), {
      target: { value: '봄꽃 스토리 촬영' },
    });
    fireEvent.change(screen.getByLabelText('장소'), {
      target: { value: '서울숲' },
    });
    fireEvent.change(screen.getByLabelText('날짜'), {
      target: { value: '2026-03-21' },
    });
    fireEvent.change(screen.getByLabelText('주제 키워드'), {
      target: { value: '봄꽃, 산책, 봄꽃' },
    });
    await user.click(screen.getByRole('button', { name: '일정 저장' }));

    await waitFor(() => {
      expect(sessionsService.create).toHaveBeenCalledWith({
        title: '봄꽃 스토리 촬영',
        location: '서울숲',
        date: '2026-03-21',
        keywords: ['봄꽃', '산책'],
      });
    });

    await waitFor(() => {
      expect(sessionsService.list).toHaveBeenCalledTimes(2);
    });
  });
});
