import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

import HomePage from '../index';
import { useAuthStore } from '@/stores/auth';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(),
}));

describe('HomePage schedule navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        id: '1',
        email: 'student@example.com',
        name: '지민',
        role: 'student',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      },
      logout: vi.fn(),
      accessToken: 'token',
      refreshToken: 'refresh',
      isLoading: false,
      isAuthenticated: true,
      error: null,
      login: vi.fn(),
      refreshTokens: vi.fn(),
      loadUser: vi.fn(),
      clearError: vi.fn(),
      setTokens: vi.fn(),
    });
  });

  it('navigates to monthly schedule page', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    await user.click(screen.getByRole('button', { name: '수업 일정 보기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/sessions');
  });

  it('opens schedule notifications and a keyboard-dismissible navigation menu', async () => {
    const user = userEvent.setup();
    render(<BrowserRouter><HomePage /></BrowserRouter>);
    await user.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByRole('region', { name: '일정 알림' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '수업 일정 확인' }));
    expect(mockNavigate).toHaveBeenCalledWith('/sessions');
    await user.click(screen.getByRole('button', { name: '메뉴' }));
    expect(screen.getByRole('navigation', { name: '바로가기 메뉴' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: '바로가기 메뉴' })).not.toBeInTheDocument();
  });
});
