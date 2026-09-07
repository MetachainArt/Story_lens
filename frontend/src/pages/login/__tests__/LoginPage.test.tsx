import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '../index';
import api from '@/services/api';
import { AUTH_FLAG_KEY } from '@/constants/auth';
import { useAuthStore } from '@/stores/auth';

const mockNavigate = vi.fn();

vi.mock('@/services/api', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const userResponse = {
  id: 'teacher-1',
  email: 'park.js',
  name: '관리자',
  role: 'teacher',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useAuthStore.setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      hasCheckedSession: false,
      error: null,
    });
  });

  it('renders an accessible ID and password form', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: '다시 오신 것을 환영해요' })).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('비밀번호')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: '이야기 만들러 가기' })).toBeDisabled();
  });

  it('enables login only after both fields are filled', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('아이디'), 'park.js');
    expect(screen.getByRole('button', { name: '이야기 만들러 가기' })).toBeDisabled();
    await user.type(screen.getByLabelText('비밀번호'), '20001004');

    expect(screen.getByRole('button', { name: '이야기 만들러 가기' })).toBeEnabled();
  });

  it('logs in through the cookie API and moves to home', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ data: { user: userResponse } });
    renderPage();

    await user.type(screen.getByLabelText('아이디'), 'park.js');
    await user.type(screen.getByLabelText('비밀번호'), '20001004');
    await user.click(screen.getByRole('button', { name: '이야기 만들러 가기' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'park.js',
        password: '20001004',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(AUTH_FLAG_KEY, '1');
  });

  it.each([
    [new Error('Network Error'), /연결/],
    [{ response: { status: 401 } }, /아이디 또는 비밀번호/],
    [{ response: { status: 429 } }, /잠시|많/],
    [{ response: { status: 502 } }, /서버/],
  ])('distinguishes login failure %j and permits retry', async (failure, message) => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce(failure);
    renderPage();
    await user.type(screen.getByLabelText('아이디'), 'test-user');
    await user.type(screen.getByLabelText('비밀번호'), 'test-password');
    await user.click(screen.getByRole('button', { name: '이야기 만들러 가기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: '이야기 만들러 가기' })).toBeEnabled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('sends only one request while a login submission is pending', async () => {
    let finish!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    renderPage();
    fireEvent.change(screen.getByLabelText('아이디'), { target: { value: 'test-user' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'test-password' } });
    const form = screen.getByLabelText('아이디').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('아이디')).toBeDisabled();
    await act(async () => { finish({ data: { user: userResponse } }); });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('shows a friendly error and keeps the user on the page', async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { detail: '아이디 또는 비밀번호가 올바르지 않습니다.' } },
    });
    renderPage();

    await user.type(screen.getByLabelText('아이디'), 'park.js');
    await user.type(screen.getByLabelText('비밀번호'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '이야기 만들러 가기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '아이디 또는 비밀번호가 올바르지 않습니다.',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-describedby', 'login-error');
  });
});
